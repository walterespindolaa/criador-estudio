import { useMemo, useState, type ReactNode } from "react";
import { Camera, CalendarDays, MapPin, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  captures, scripts, envios, clientName, acoes, aoAbrirDia, maxHistorico = 12, historicoForaDoMes,
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
  /* PASTA DO CLIENTE (Walter, 19/10/2026): a pasta já lista o mês aberto dia
     a dia, então o histórico ali repetia as mesmas datas. Com "YYYY-MM", o
     histórico mostra só os OUTROS meses e nasce fechado. */
  historicoForaDoMes?: string;
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
  const historico = useMemo(
    () => minhas.filter((c) => c !== proxima && (!historicoForaDoMes || c.capture_date.slice(0, 7) !== historicoForaDoMes)).slice().reverse(),
    [minhas, proxima, historicoForaDoMes],
  );
  const gravados = scripts.filter((s) => s.done).length;
  const [historicoAberto, setHistoricoAberto] = useState(!historicoForaDoMes);
  const numeros = [
    { valor: minhas.filter((c) => c.status !== "cancelada").length, rotulo: (n: number) => (n === 1 ? "gravação" : "gravações") },
    { valor: minhas.filter((c) => c.status === "concluida").length, rotulo: (n: number) => (n === 1 ? "concluída" : "concluídas") },
  ];

  return (
    <div className="space-y-4">
      {/* ── Próxima gravação + números numa faixa só (Walter, 19/10/2026:
             "muito espaçado esses quadros, ocupa muito espaço") ── */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3 flex-wrap px-4 py-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Camera className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--cria-verde))]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-body text-foreground">
                <span className="text-muted-foreground">Próxima gravação: </span>
                {proxima ? (
                  <>
                    <strong className="font-display">{dataCurta(proxima.capture_date)}</strong>
                    <span className="text-muted-foreground"> · {quandoLabel(proxima.capture_date, hoje)}</span>
                    {proxima.capture_time && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {proxima.capture_time.slice(0, 5)}</span>}
                    {proxima.location && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {proxima.location}</span>}
                  </>
                ) : (
                  <strong className="font-display">nada agendado</strong>
                )}
              </p>
              {proxima && <Escada p={prontidaoDa(proxima, scripts, envios)} />}
              {!proxima && minhas.length === 0 && (
                <p className="text-xs font-body text-muted-foreground mt-0.5">Ainda não tem gravação marcada pra {clientName || "este cliente"}.</p>
              )}
            </div>
          </div>
          {acoes && <div className="flex items-center gap-2 flex-wrap shrink-0">{acoes}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 text-[13px] font-body text-muted-foreground">
          {numeros.map((n, i) => (
            <span key={i}><strong className="font-display text-[15px] text-foreground">{n.valor}</strong> {n.rotulo(n.valor)}</span>
          ))}
          <span>
            <strong className="font-display text-[15px] text-foreground">{scripts.length ? `${gravados}/${scripts.length}` : "0"}</strong>
            {" "}{scripts.length ? "roteiros gravados" : "roteiros"}
          </span>
        </div>
      </div>

      {/* ── Histórico ── */}
      {!(historicoForaDoMes && historico.length === 0) && (
      <div className={cn("rounded-2xl border border-border bg-card", historicoAberto ? "p-5" : "")}>
        <button type="button" onClick={() => setHistoricoAberto((v) => !v)}
          className={cn("w-full text-sm font-display font-bold text-foreground flex items-center gap-2 text-left", historicoAberto ? "mb-3" : "px-4 py-3")}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {historicoForaDoMes ? "Histórico de outros meses" : "Histórico de gravações"}
          {!historicoAberto && <span className="text-xs font-body font-normal text-muted-foreground">· {historico.length} {historico.length === 1 ? "gravação" : "gravações"}</span>}
          <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", historicoAberto && "rotate-180")} />
        </button>
        {!historicoAberto ? null : historico.length === 0 ? (
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
        {historicoAberto && historico.length > maxHistorico && (
          <p className="text-[11px] font-body text-muted-foreground mt-2">Mostrando as {maxHistorico} mais recentes.</p>
        )}
      </div>
      )}
    </div>
  );
}
