import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBrandItems } from "@/hooks/useBrandItems";
import { usePillars } from "@/hooks/usePillars";
import { usePersonas } from "@/hooks/usePersonas";

/* QUEM É VOCÊ COMPACTO (Walter, 19/10/2026, mockup aprovado).
   O card virava uma coluna comprida: "Para quem" despejava o texto inteiro de
   cada persona e pilares quase iguais apareciam duas vezes. Agora tudo é chip,
   "Pra quem" mostra só o nome da persona (o texto abre em "Ver as personas") e
   pilares com o mesmo nome normalizado aparecem uma vez. */

// "Inteligencia Artificial / Sistemas" e "Inteligência artificial e sistemas" viram a mesma chave.
const chave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\s*\/\s*/g, " e ").replace(/\s+/g, " ").trim();

const Linha = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[64px_1fr] items-start gap-3">
    <span className="pt-1 text-xs text-muted-foreground">{rotulo}</span>
    <div className="min-w-0">{children}</div>
  </div>
);

export function WhoYouAre() {
  const navigate = useNavigate();
  const { profile } = useActiveProfile();
  const { brandItems } = useBrandItems();
  const { pillars } = usePillars();
  const { personas } = usePersonas();
  const [verPersonas, setVerPersonas] = useState(false);

  const tom = brandItems.filter((i) => i.type === "tom").map((i) => i.name).slice(0, 4);
  const nichos = (profile?.niche ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  const pilaresUnicos = pillars.filter((p, i) => pillars.findIndex((o) => chave(o.name) === chave(p.name)) === i);
  const empty = nichos.length === 0 && tom.length === 0 && pillars.length === 0 && personas.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-bold">
          <UserCircle className="h-4 w-4 text-primary" /> Quem é você
        </h3>
        <span className="text-xs text-muted-foreground">resumo do Brandbook</span>
        {!empty && (
          <button onClick={() => navigate("/app/brandbook")} className="ml-auto text-xs font-bold text-primary hover:underline">
            Editar
          </button>
        )}
      </div>
      {empty ? (
        <p className="py-2 text-sm text-muted-foreground">Monte seu Brandbook pra ver seu resumo aqui. <button onClick={() => navigate("/app/brandbook")} className="font-semibold text-primary">Começar</button></p>
      ) : (
        <div className="space-y-2.5 text-sm">
          {nichos.length > 0 && (
            <Linha rotulo="Nicho">
              <div className="flex flex-wrap gap-1.5">
                {nichos.map((n) => <span key={n} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground/80">{n}</span>)}
              </div>
            </Linha>
          )}
          {tom.length > 0 && (
            <Linha rotulo="Tom">
              {/* Pílula só pra item CURTO: tom escrito como frase longa virava um balão gigante (31/08). */}
              <div className="flex flex-wrap gap-1.5">{tom.map((t) => (
                t.length <= 40
                  ? <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{t}</span>
                  : <span key={t} className="text-[13px] leading-relaxed text-foreground/90">{t}</span>
              ))}</div>
            </Linha>
          )}
          {pilaresUnicos.length > 0 && (
            <Linha rotulo="Pilares">
              <div className="flex flex-wrap gap-1.5">{pilaresUnicos.slice(0, 5).map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color ?? "var(--primary)" }} />{p.name}
                </span>
              ))}</div>
            </Linha>
          )}
          {personas.length > 0 && (
            // TODAS as personas (a Gabriela tem duas e o card mostrava uma), só o nome.
            <Linha rotulo="Pra quem">
              <div className="flex flex-wrap gap-1.5">
                {personas.map((p) => (
                  <span key={p.id ?? p.name} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground">{p.name}</span>
                ))}
              </div>
              {personas.some((p) => p.how_you_help) && (
                <button onClick={() => setVerPersonas((v) => !v)} className="mt-1.5 text-xs font-bold text-primary hover:underline">
                  {verPersonas ? "Fechar as personas" : "Ver as personas"}
                </button>
              )}
              {verPersonas && (
                <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-foreground/90">
                  {personas.filter((p) => p.how_you_help).map((p) => (
                    <p key={p.id ?? p.name}><b className="font-semibold">{p.name}:</b> {p.how_you_help}</p>
                  ))}
                </div>
              )}
            </Linha>
          )}
        </div>
      )}
    </div>
  );
}

export default WhoYouAre;
