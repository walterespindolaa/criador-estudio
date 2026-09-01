import { useNavigate } from "react-router-dom";
import { UserCircle } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBrandItems } from "@/hooks/useBrandItems";
import { usePillars } from "@/hooks/usePillars";
import { usePersonas } from "@/hooks/usePersonas";

export function WhoYouAre() {
  const navigate = useNavigate();
  const { profile } = useActiveProfile();
  const { brandItems } = useBrandItems();
  const { pillars } = usePillars();
  const { personas } = usePersonas();

  const tom = brandItems.filter((i) => i.type === "tom").map((i) => i.name).slice(0, 4);
  const niche = profile?.niche?.trim();
  const empty = !niche && tom.length === 0 && pillars.length === 0 && personas.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
      <h3 className="mb-1 flex items-center gap-2 font-display text-[15px] font-bold">
        <UserCircle className="h-4 w-4 text-primary" /> Quem é você
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">Resumo do seu Brandbook</p>
      {empty ? (
        <p className="py-2 text-sm text-muted-foreground">Monte seu Brandbook pra ver seu resumo aqui. <button onClick={() => navigate("/app/brandbook")} className="font-semibold text-primary">Começar →</button></p>
      ) : (
        <div className="space-y-3 text-sm">
          {niche && (<div className="flex gap-2"><span className="min-w-[58px] shrink-0 text-xs text-muted-foreground">Nicho</span><span>{niche}</span></div>)}
          {tom.length > 0 && (
            <div className="flex gap-2"><span className="min-w-[58px] shrink-0 pt-1 text-xs text-muted-foreground">Tom</span>
              {/* Pílula redonda só pra item CURTO. Tom escrito como frase longa
                 virava um balão rosa gigante (print do Walter, 31/08). */}
              <span className="flex flex-wrap gap-1.5">{tom.map((t) => (
                t.length <= 40
                  ? <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>
                  : <span key={t} className="text-[13px] leading-relaxed text-foreground/90">{t}</span>
              ))}</span>
            </div>
          )}
          {pillars.length > 0 && (
            <div className="flex gap-2"><span className="min-w-[58px] shrink-0 pt-1 text-xs text-muted-foreground">Pilares</span>
              <span className="flex flex-wrap gap-1.5">{pillars.slice(0, 5).map((p) => (<span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color ?? "var(--primary)" }} />{p.name}</span>))}</span>
            </div>
          )}
          {personas.length > 0 && (
            // TODAS as personas, não só a primeira: quem cadastra duas quer ver
            // as duas aqui (a Gabriela tem duas e o card mostrava uma).
            <div className="flex gap-2"><span className="min-w-[58px] shrink-0 pt-0.5 text-xs text-muted-foreground">Para quem</span>
              <span className="flex flex-col gap-1">
                {personas.map((p) => (
                  <span key={p.id ?? p.name}>{p.name}{p.how_you_help ? `, ${p.how_you_help}` : ""}</span>
                ))}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WhoYouAre;
