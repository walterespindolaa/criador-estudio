import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://localhost:8080',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface PostPayload {
  id: string
  title: string
  scheduledDate: string          // 'YYYY-MM-DD'
  scheduledTime?: string | null  // 'HH:MM' or null -> all-day event
  caption?: string | null
  notes?: string | null
  platform?: string | null
  format?: string | null
}

// --- date helpers (string-based, UTC-safe so server timezone never interferes) ---
const pad = (n: number) => String(n).padStart(2, '0')

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function addMinutesWallClock(dateStr: string, timeStr: string, minutes: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm))
  dt.setUTCMinutes(dt.getUTCMinutes() + minutes)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:00`
}

function buildEvent(
  post: PostPayload,
  timeZone: string,
  reminderMinutes: number,
  durationMinutes: number,
): Record<string, unknown> {
  const meta = [post.platform, post.format].filter(Boolean).join(' · ')
  const description = [
    (post.caption || post.notes || '').trim(),
    '',
    meta,
    '— Agendado pelo CreatorsFlow',
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .trim()

  const event: Record<string, unknown> = {
    summary: post.title?.trim() || 'Publicação',
    description,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: reminderMinutes },
        { method: 'email', minutes: reminderMinutes },
      ],
    },
  }

  const hasTime = !!post.scheduledTime && /^\d{2}:\d{2}/.test(post.scheduledTime)
  if (hasTime) {
    const time = post.scheduledTime!.slice(0, 5)
    event.start = { dateTime: `${post.scheduledDate}T${time}:00`, timeZone }
    event.end = { dateTime: addMinutesWallClock(post.scheduledDate, time, durationMinutes), timeZone }
  } else {
    // all-day event (end date is exclusive in the Calendar API)
    event.start = { date: post.scheduledDate }
    event.end = { date: addDays(post.scheduledDate, 1) }
  }

  return event
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- authenticate the Supabase user (prevents anonymous abuse of the function) ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing auth' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } =
      await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json()
    const {
      action,
      accessToken,
      eventId,
      post,
      timeZone = 'America/Sao_Paulo',
      reminderMinutes = 60,
      durationMinutes = 30,
    } = body as {
      action: 'upsert' | 'delete'
      accessToken?: string
      eventId?: string | null
      post?: PostPayload
      timeZone?: string
      reminderMinutes?: number
      durationMinutes?: number
    }

    if (!accessToken) return json({ error: 'Missing accessToken' }, 400)

    // ---------------- DELETE ----------------
    if (action === 'delete') {
      if (!eventId) return json({ ok: true }) // nothing to remove
      const res = await fetch(`${CALENDAR_API}/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      // 200/204 = deleted, 404/410 = already gone -> all fine
      if (res.ok || res.status === 404 || res.status === 410) return json({ ok: true })
      if (res.status === 401) return json({ ok: false, code: 'token_expired' })
      const errText = await res.text()
      console.error('Calendar delete error:', res.status, errText)
      return json({ ok: false, code: 'google_error', error: 'Falha ao remover evento' })
    }

    // ---------------- UPSERT ----------------
    if (action === 'upsert') {
      if (!post?.scheduledDate) return json({ error: 'Missing post.scheduledDate' }, 400)

      const event = buildEvent(post, timeZone, reminderMinutes, durationMinutes)
      const isUpdate = !!eventId
      const url = isUpdate ? `${CALENDAR_API}/${encodeURIComponent(eventId!)}` : CALENDAR_API

      const res = await fetch(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      })

      if (res.status === 401) return json({ ok: false, code: 'token_expired' })

      // If we tried to PATCH an event the user deleted manually, recreate it.
      if (isUpdate && (res.status === 404 || res.status === 410)) {
        const recreate = await fetch(CALENDAR_API, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        })
        if (recreate.status === 401) return json({ ok: false, code: 'token_expired' })
        if (!recreate.ok) {
          const t = await recreate.text()
          console.error('Calendar recreate error:', recreate.status, t)
          return json({ ok: false, code: 'google_error', error: 'Falha ao recriar evento' })
        }
        const data = await recreate.json()
        return json({ ok: true, eventId: data.id, htmlLink: data.htmlLink })
      }

      if (!res.ok) {
        const t = await res.text()
        console.error('Calendar upsert error:', res.status, t)
        return json({ ok: false, code: 'google_error', error: 'Falha ao salvar evento' })
      }

      const data = await res.json()
      return json({ ok: true, eventId: data.id, htmlLink: data.htmlLink })
    }

    return json({ error: 'Invalid action' }, 400)
  } catch (err) {
    console.error('google-calendar-sync error:', err)
    return json({ error: String(err) }, 500)
  }
})
