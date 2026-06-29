import { useMemo, useRef, useState, useEffect, type ReactNode, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { IdCard, Download, Pencil, Instagram, Upload, FileText, Trash2, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useSocialConnection, useDailyMetrics, useMediaInsights, connectInstagram } from "@/hooks/useSocialInsights";
import { useMediaKitProfile, useSaveMediaKitProfile, useCustomMediaKit, type MediaKitProfile, type KitService } from "@/hooks/useMediaKit";
import { AutoMediaKit, type KitStats, type KitTopPost } from "@/components/mediakit/AutoMediaKit";
import { toast } from "sonner";

export default function MediaKit() {
  const { profile } = useProfile();
  const { data: conn } = useSocialConnection();
  const { data: daily = [] } = useDailyMetrics(30);
  const { data: media = [] } = useMediaInsights();
  const { data: kit } = useMediaKitProfile();
  const save = useSaveMediaKitProfile();
  const custom = useCustomMediaKit();
  const printRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MediaKitProfile | null>(null);
  useEffect(() => { if (kit && !form) setForm(kit); }, [kit, form]);

  const stats: KitStats = useMemo(() => {
    const followers = [...daily].reverse().find((d) => d.followers != null)?.followers ?? 0;
    const reachMonth = daily.reduce((s, d) => s + (d.reach ?? 0), 0);
    const interactions = daily.reduce((s, d) => s + (d.total_interactions ?? 0), 0);
    const engagementPct = reachMonth > 0 ? Math.min(100, (interactions / reachMonth) * 100) : 0;
    const saves = media.reduce((s, m) => s + (m.metrics?.saved ?? m.metrics?.saves ?? 0), 0);
    return { followers, reachMonth, engagementPct, saves };
  }, [daily, media]);

  const topPosts: KitTopPost[] = useMemo(() => {
    return [...media]
      .map((m) => ({
        title: m.posts?.title || (m.caption || "").slice(0, 60) || "Publicação",
        format: m.posts?.format || (m.media_type === "VIDEO" ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto"),
        reach: m.metrics?.reach ?? 0,
        saves: m.metrics?.saved ?? m.metrics?.saves ?? 0,
        thumbnail_url: m.thumbnail_url,
      }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 3);
  }, [media]);

  const handle = conn?.username ? `@${conn.username}` : (profile?.name ? `@${profile.name.split(" ")[0].toLowerCase()}` : "@voce");

  const doSave = async () => {
    if (!form) return;
    await save.mutateAsync(form);
    setEditing(false);
    toast.success("Media kit atualizado!");
  };

  const patchService = (i: number, p: Partial<KitService>) =>
    setForm((f) => f ? { ...f, services: (f.services ?? []).map((s, idx) => idx === i ? { ...s, ...p } : s) } : f);

  const liveKit = (form ?? kit) as MediaKitProfile | undefined;

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) custom.upload.mutate(file);
    e.target.value = "";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <IdCard className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Media Kit</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Seu portfólio pra fechar publis — automático com seus números, ou o seu PDF personalizado.</p>
        </div>
      </div>

      {/* ===== Automático ===== */}
      <section className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Media kit automático</h2>
          {conn && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Editar dados</Button>
              <Button size="sm" onClick={() => window.print()} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Baixar PDF</Button>
            </div>
          )}
        </div>

        {!conn ? (
          <div className="border border-dashed border-border rounded-2xl py-14 px-6 text-center">
            <Instagram className="h-7 w-7 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium">Conecte o Instagram pra gerar o media kit</p>
            <p className="text-xs font-body text-muted-foreground mt-1 mb-4">Os números, audiência e melhores posts são puxados automaticamente.</p>
            <Button onClick={() => connectInstagram()} className="gap-2"><Instagram className="h-4 w-4" /> Conectar Instagram</Button>
          </div>
        ) : (
          <>
            {editing && form && (
              <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Bio (frase de apresentação)"><textarea value={form.bio ?? profile?.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-card p-2.5 text-sm font-body outline-none resize-none focus:ring-1 focus:ring-primary/30" /></Field>
                  <Field label="Nichos (separe por vírgula)"><input value={form.niche ?? profile?.niche ?? ""} onChange={(e) => setForm({ ...form, niche: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" /></Field>
                  <Field label="Contato (e-mail/WhatsApp)"><input value={form.contact ?? ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="voce@email.com" className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" /></Field>
                  <Field label="Top cidades"><input value={form.cities ?? ""} onChange={(e) => setForm({ ...form, cities: e.target.value })} placeholder="São Paulo, Rio, BH" className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" /></Field>
                </div>

                <div>
                  <p className="text-xs font-body text-muted-foreground mb-2">Audiência por idade (%)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(form.audience ?? []).map((b, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input value={b.label} onChange={(e) => setForm({ ...form, audience: form.audience!.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) })} className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none" />
                        <input type="number" value={b.pct} onChange={(e) => setForm({ ...form, audience: form.audience!.map((x, idx) => idx === i ? { ...x, pct: Number(e.target.value) } : x) })} className="w-14 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-body text-muted-foreground">Gênero %</span>
                  <label className="text-xs flex items-center gap-1.5">Mulheres <input type="number" value={form.gender?.women ?? 60} onChange={(e) => setForm({ ...form, gender: { women: Number(e.target.value), men: 100 - Number(e.target.value) } })} className="w-14 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none" /></label>
                  <span className="text-xs text-muted-foreground">Homens {100 - (form.gender?.women ?? 60)}%</span>
                </div>

                <div>
                  <p className="text-xs font-body text-muted-foreground mb-2">Formatos de parceria e valores</p>
                  <div className="space-y-2">
                    {(form.services ?? []).map((s, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
                          <input value={s.name} onChange={(e) => patchService(i, { name: e.target.value })} placeholder="Nome" className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none" />
                          <input value={s.desc} onChange={(e) => patchService(i, { desc: e.target.value })} placeholder="Descrição" className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none" />
                          <input value={s.price} onChange={(e) => patchService(i, { price: e.target.value })} placeholder="R$ 0" className="w-24 rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none" />
                        </div>
                        <button onClick={() => setForm({ ...form, services: form.services!.filter((_, idx) => idx !== i) })} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remover"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => setForm({ ...form, services: [...(form.services ?? []), { name: "", desc: "", price: "R$ 0" }] })} className="text-xs font-body text-primary flex items-center gap-1.5 mt-1"><Plus className="h-3.5 w-3.5" /> Adicionar formato</button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => { setForm(kit ?? null); setEditing(false); }}>Cancelar</Button>
                  <Button size="sm" onClick={doSave} disabled={save.isPending} className="gap-1.5">{save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salvar</Button>
                </div>
              </div>
            )}

            <div className="max-w-[820px]">
              {liveKit && (
                <AutoMediaKit
                  ref={printRef}
                  name={profile?.name ?? "Seu nome"}
                  handle={handle}
                  niche={liveKit.niche ?? profile?.niche ?? ""}
                  bio={liveKit.bio ?? profile?.bio ?? ""}
                  kit={liveKit}
                  stats={stats}
                  posts={topPosts}
                />
              )}
            </div>
          </>
        )}
      </section>

      {/* ===== Personalizado ===== */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Media kit personalizado</h2>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-body text-muted-foreground leading-relaxed mb-4">
            Prefere desenhar do seu jeito? Edite no Canva (ou onde quiser), exporte em PDF e suba aqui. Fica disponível pra baixar e compartilhar como portfólio.
          </p>

          {custom.file ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground truncate">{custom.file.name}</p>
                  <p className="text-xs font-body text-muted-foreground">Enviado em {new Date(custom.file.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={custom.openFile} className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Abrir</Button>
                <label className="cursor-pointer">
                  <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"><Upload className="h-3.5 w-3.5" /> Trocar</span>
                </label>
                <Button variant="ghost" size="sm" onClick={() => custom.remove.mutate()} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <label className="block cursor-pointer border border-dashed border-border rounded-xl py-10 px-6 text-center hover:border-primary/40 transition-colors">
              <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
              {custom.upload.isPending ? (
                <Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" />
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-body text-foreground font-medium">Subir meu PDF</p>
                  <p className="text-xs font-body text-muted-foreground mt-1">PDF até 15 MB</p>
                </>
              )}
            </label>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-body text-muted-foreground mb-1.5">{label}</p>
      {children}
    </div>
  );
}
