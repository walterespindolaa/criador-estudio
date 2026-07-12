import { useMemo } from "react";
import { BookMarked, Heart, Users, Mic, Palette, BookOpen, Sparkles, RefreshCw } from "lucide-react";
import { useCriaClientBrandbook, type CriaClientMoodboardEntry } from "@/hooks/useManagerClientCria";

// Brandbook do cliente que USA O CRIA, renderizado em modo LEITURA na aba Criativo
// da ficha. Espelha as seções do Brandbook do lado criador (moodboard_entries,
// brand_items, personas, pillars). Quem edita é o cliente, no CRIA dele.

const SECTION_LABELS: Record<string, string> = {
  "moodboard-identidade": "Identidade e sensações",
  "moodboard-visual": "Visual e estilo",
  "moodboard-contexto": "Contexto e propósito",
  "moodboard-inspiracoes": "Inspirações pessoais",
  "visao-de-mundo": "Visão de mundo",
  "sobre-voce": "Sobre o criador",
  "linha-editorial": "Linha editorial",
  "persona-brand": "Persona (perguntas guiadas)",
  "tom-de-voz": "Tom de voz",
};
const MOODBOARD_SECTIONS = ["moodboard-identidade", "moodboard-visual", "moodboard-contexto", "moodboard-inspiracoes", "visao-de-mundo", "sobre-voce"];
const ITEM_TYPE_LABELS: Record<string, string> = {
  cor: "Cores", fonte: "Fontes", tom: "Tom de voz", expressao: "Expressões que usa", evitar: "Palavras que evita", value: "Valores",
};
const isHex = (v: string | null) => !!v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

export function ClienteBrandbookCria({ criaOwnerId }: { criaOwnerId: string }) {
  const { data, isLoading, isError } = useCriaClientBrandbook(criaOwnerId);

  const moodboardBySection = useMemo(() => {
    const map: Record<string, CriaClientMoodboardEntry[]> = {};
    (data?.moodboard ?? []).forEach((e) => {
      if (!e.answer?.trim()) return;
      (map[e.section] ||= []).push(e);
    });
    return map;
  }, [data?.moodboard]);

  const itemsByType = useMemo(() => {
    const map: Record<string, { name: string; value: string | null }[]> = {};
    (data?.brand_items ?? []).forEach((i) => { (map[i.type] ||= []).push({ name: i.name, value: i.value }); });
    return map;
  }, [data?.brand_items]);

  if (isLoading) {
    return <div className="h-40 rounded-2xl bg-muted animate-pulse" />;
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-body text-muted-foreground">Não foi possível carregar o brandbook do cliente agora.</p>
      </div>
    );
  }

  const hasAnything = !!data && (
    data.pillars.length > 0 || data.brand_items.length > 0 || data.personas.length > 0 ||
    Object.keys(moodboardBySection).length > 0 || !!data.profile?.niche
  );

  return (
    <div className="space-y-4">
      {/* Cabeçalho + aviso de origem */}
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 flex items-start gap-2.5">
        <BookMarked className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-display font-bold text-foreground">Brandbook do cliente</p>
          <p className="text-[12px] font-body text-muted-foreground flex items-center gap-1 flex-wrap">
            <RefreshCw className="h-3 w-3 shrink-0" /> Sincronizado do CRIA do cliente, edite lá pra atualizar aqui.
          </p>
        </div>
      </div>

      {!hasAnything ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-body text-foreground font-medium">O cliente ainda não preencheu o Brandbook</p>
          <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
            Peça pra ele preencher o Brandbook no CRIA dele (nicho, tom de voz, persona e moodboard). Tudo aparece aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Nicho + pilares */}
          {(data.profile?.niche || data.pillars.length > 0) && (
            <SectionCard icon={BookOpen} title="Nicho e pilares">
              {data.profile?.niche && <p className="text-sm font-body text-foreground mb-2">{data.profile.niche}</p>}
              {data.pillars.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.pillars.map((p) => (
                    <span key={p} className="text-[11px] font-body px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p}</span>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Identidade visual e tom (brand_items) */}
          {data.brand_items.length > 0 && (
            <SectionCard icon={Palette} title="Identidade da marca">
              <div className="space-y-2.5">
                {Object.entries(itemsByType).map(([type, items]) => (
                  <div key={type}>
                    <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">{ITEM_TYPE_LABELS[type] ?? type}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((i, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-body px-2 py-0.5 rounded-full bg-muted text-foreground">
                          {isHex(i.value) && <span className="h-2.5 w-2.5 rounded-full border border-border/60" style={{ background: i.value! }} />}
                          {i.name}{i.value && !isHex(i.value) ? ` (${i.value})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Personas */}
          {data.personas.length > 0 && (
            <SectionCard icon={Users} title="Público e persona">
              <div className="space-y-2.5">
                {data.personas.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-border/60 p-3">
                    <p className="text-sm font-body font-semibold text-foreground">
                      {p.name || `Persona ${idx + 1}`}
                      {(p.age_range || p.location) && <span className="text-muted-foreground font-normal"> · {[p.age_range, p.gender, p.location].filter(Boolean).join(", ")}</span>}
                    </p>
                    {!!p.pain_points?.length && <p className="text-xs font-body text-muted-foreground mt-1"><strong className="text-foreground/80">Dores:</strong> {p.pain_points.join(", ")}</p>}
                    {!!p.desires?.length && <p className="text-xs font-body text-muted-foreground mt-0.5"><strong className="text-foreground/80">Desejos:</strong> {p.desires.join(", ")}</p>}
                    {!!p.interests?.length && <p className="text-xs font-body text-muted-foreground mt-0.5"><strong className="text-foreground/80">Interesses:</strong> {p.interests.join(", ")}</p>}
                    {p.how_you_help && <p className="text-xs font-body text-muted-foreground mt-0.5"><strong className="text-foreground/80">Como ajuda:</strong> {p.how_you_help}</p>}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Tom de voz + linha editorial + persona guiada (respostas do moodboard) */}
          {(["tom-de-voz", "linha-editorial", "persona-brand"] as const).map((sec) =>
            moodboardBySection[sec]?.length ? (
              <SectionCard key={sec} icon={sec === "tom-de-voz" ? Mic : BookOpen} title={SECTION_LABELS[sec]}>
                <AnswerList entries={moodboardBySection[sec]} />
              </SectionCard>
            ) : null
          )}

          {/* Moodboard (seções de texto do lado criador) */}
          {MOODBOARD_SECTIONS.some((s) => moodboardBySection[s]?.length) && (
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center"><Heart className="h-4 w-4 text-primary" /></div>
                <p className="text-sm font-display font-bold text-foreground">Moodboard</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MOODBOARD_SECTIONS.filter((s) => moodboardBySection[s]?.length).map((s) => (
                  <div key={s} className="rounded-xl border border-border/60 p-3">
                    <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{SECTION_LABELS[s] ?? s}</p>
                    <AnswerList entries={moodboardBySection[s]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center"><Icon className="h-4 w-4 text-primary" /></div>
        <p className="text-sm font-display font-bold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

function AnswerList({ entries }: { entries: CriaClientMoodboardEntry[] }) {
  return (
    <div className="space-y-1.5">
      {entries.map((e) => (
        <p key={`${e.section}-${e.question_key}`} className="text-xs font-body text-foreground/85 leading-relaxed">
          <span className="text-muted-foreground/70">• </span>{e.answer}
        </p>
      ))}
    </div>
  );
}
