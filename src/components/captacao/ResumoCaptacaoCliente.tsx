import { useMemo, type ReactNode } from "react";
import { Camera, CalendarDays, FileText, Check, MapPin, Clock } from "lucide-react";
import { hojeBR } from "@/lib/date-br";
import { prontidaoDa, type CapturaPainel, type RoteiroMin, type AprovacaoMin } from "@/lib/captacao-prontidao";
import { SeloProntidao } from "@/components/captacao/SeloProntidao";
import { Escada } from "@/components/captacao/PainelDeVoo";

/* ═══════════════════════════════════════════════════════════════════════════
   O RESUMO DE CAPTAÇÃO DE UM CLIENTE (v4, ciclo 4)

   "Essa página ficou muito melhor que o Cria Captação" (Gabriela, 23/09).
   Ela falava da aba da ficha. A pasta do cliente dentro do módulo mostrava a
   mesma coisa de outro jeito, pior. Agora é UM componente: próxima gravação
   com a escada, três números, histórico com prontidão. A ficha e a pasta
   montam o mesmo bloco, então nunca mais divergem, e quem chega por qualquer
   um dos dois lê a mesma tela.

   Ele não busca nada: recebe as listas já filtradas pro cliente. Quem tem as
   ações (novo roteiro, marcar, guia, enviar) passa no slot `acoes`.
   ═══════════════════════════════════════════════════════════════════════════ */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1] ?? ""} ${a}`;
}
function distanciaEmDias(iso: string, hoje: string): number {
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) / 86400000);
}
function quandoLabel(iso: string, hoje = hojeBR()): string {
  const d = distanciaEmDias(iso, hoje);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d > 1) return `em ${d} dias`;
  if (d === -1) return "ontem";
  return `há ${Math.abs(d)} dias`;
}

export function ResumoCaptacaoCliente({
  captures, scripts, envios, clientName, acoes, aoAbrirDia, maxHistorico = 12,
}: {
  /** Só as captações DESTE cliente (qualquer status, qualquer mês). */
  captures: CapturaPainel[];
  /** Só os roteiros deste cliente. */
  scripts: RoteiroMin[];
  envios: AprovacaoMin[];
  clientName: string;
  /** Botões do cabeçalho (novo roteiro, marcar, guia, enviar). */
  acoes?: ReactNode;
  /** Se existir, a linha do histórico vira clicável e abre o dia. */
  aoAbrirDia?: (date: string) => void;
  maxHistorico?: number;
}) {
  const hoje = hojeBR();
  const minhas = useMemo(
    () => [...captures].sort((a, b) => a.capture_date.localeCompare(b.capture_date)),
    [captures],
  );
  const proxima = useMemo(
    () => minhas.find((c) => c.status === "agendada" && c.capture_date >= hoje) ?? null,
    [minhas, hoje],
  );
  const historico = useMemo(() => minhas.filter((c) => c !== proxima).slice().reverse(), [minhas, proxima]);
  const gravados = scripts.filter((s) => s.done).length;

  return (
    <div className="space-y-4">
      {/* ── Próxima gravação ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--cria-verde))]/12 grid place-items-center shrink-0">
              <Camera className="h-5 w-5 text-[hsl(var(--cria-verde))]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground">Próxima gravação</p>
              {proxima ? (
                <>
                  <p className="text-lg font-display font-extrabold text-foreground leading-tight">
                    {dataCurta(proxima.capture_date)} <span className="text-sm font-semibold text-muted-foreground">· {quandoLabel(proxima.capture_date, hoje)}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs font-body text-muted-foreground">
                    {proxima.capture_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {proxima.capture_time.slice(0, 5)}</span>}
                    {proxima.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {proxima.location}</span>}
                  </div>
                  <Escada p={prontidaoDa(proxima, scripts, envios)} />
                </>
              ) : (
                <>
                  <p className="text-lg font-display font-extrabold text-foreground leading-tight">Nada agendado</p>
                  <p className="text-xs font-body text-muted-foreground mt-0.5">
                    {minhas.length > 0 ? "Este cliente já gravou antes, mas não tem data marcada pra frente." : `Ainda não tem gravação marcada pra ${clientName || "este cliente"}.`}
                  </p>
                </>
              )}
            </div>
          </div>
          {acoes && <div className="flex items-center gap-2 flex-wrap shrink-0">{acoes}</div>}
        </div>
      </div>

      {/* ── Três números ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { rotulo: "Gravações", valor: minhas.filter((c) => c.status !== "cancelada").length, icon: Camera },
          { rotulo: "Concluídas", valor: minhas.filter((c) => c.status === "concluida").length, icon: Check },
          { rotulo: "Roteiros", valor: scripts.length ? `${gravados}/${scripts.length}` : "0", icon: FileText },
        ].map(({ rotulo, valor, icon: Icon }) => (
          <div key={rotulo} className="rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{rotulo}</span>
            </div>
            <p className="text-2xl font-display font-extrabold text-foreground leading-none mt-1.5">{valor}</p>
          </div>
        ))}
      </div>

      {/* ── Histórico ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Histórico de gravações
        </p>
        {historico.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground py-2">
            Nenhuma gravação registrada ainda. As que você marcar aparecem aqui.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {historico.slice(0, maxHistorico).map((c) => {
              const p = prontidaoDa(c, scripts, envios);
              const Linha = aoAbrirDia ? "button" : "div";
              return (
                <li key={c.id}>
                  <Linha type={aoAbrirDia ? "button" : undefined}
                    onClick={aoAbrirDia ? () => aoAbrirDia(c.capture_date) : undefined}
                    className={"w-full flex items-center gap-3 py-2.5 text-left" + (aoAbrirDia ? " hover:bg-muted/30 rounded-lg px-1 -mx-1 transition-colors" : "")}>
                    <span className="text-sm font-body font-semibold text-foreground shrink-0">{dataCurta(c.capture_date)}</span>
                    {c.location && <span className="text-xs font-body text-muted-foreground truncate">{c.location}</span>}
                    {p.detalhe && <span className="hidden sm:inline text-[11px] font-body text-muted-foreground truncate ml-auto">{p.detalhe}</span>}
                    <SeloProntidao p={p} className={p.detalhe ? "" : "ml-auto"} />
                  </Linha>
                </li>
              );
            })}
          </ul>
        )}
        {historico.length > maxHistorico && (
          <p className="text-[11px] font-body text-muted-foreground mt-2">Mostrando as {maxHistorico} mais recentes.</p>
        )}
      </div>
    </div>
  );
}
