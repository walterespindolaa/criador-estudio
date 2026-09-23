import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Camera, CalendarDays, FileText, Check, MapPin, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCaptures } from "@/hooks/useAgenda";
import { useCaptureScripts } from "@/hooks/useCaptureScripts";
import { useScriptApprovalsTodos } from "@/hooks/useScriptApprovals";
import { hojeBR } from "@/lib/date-br";
import { prontidaoDa } from "@/lib/captacao-prontidao";
import { SeloProntidao } from "@/components/captacao/SeloProntidao";
import { Escada } from "@/components/captacao/PainelDeVoo";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA CAPTAÇÃO DENTRO DA FICHA DO CLIENTE (Gabriela, 23/09/2026)

   "não tem como ter a captação aqui em cima também? todos os outros têm."

   Tinha razão: a barra de cima da ficha mostrava Cria Post, Cria Gestão, Cria
   Caixa e Cria Radar, e a Captação era o único módulo ativo dela que ficava de
   fora. Quem estava dentro do cliente tinha que sair pro menu lateral, abrir o
   módulo e procurar a pasta daquele cliente de novo.

   O que esta aba mostra é o RECORTE deste cliente: as gravações dele e os
   roteiros dele. O planejamento de rota (quem gravar no mesmo dia, em qual
   cidade, na mesma ida) continua só no módulo, porque é uma decisão que
   atravessa VÁRIOS clientes e não cabe na ficha de um. Por isso o botão de
   abrir a pasta completa fica em evidência aqui em cima.
   ═══════════════════════════════════════════════════════════════════════════ */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1] ?? ""} ${a}`;
}
// Quantos dias faltam (ou passaram) em relação a hoje, no fuso de Brasília.
function distanciaEmDias(iso: string): number {
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date(`${hojeBR()}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}
function quandoLabel(iso: string): string {
  const d = distanciaEmDias(iso);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d > 1) return `em ${d} dias`;
  if (d === -1) return "ontem";
  return `há ${Math.abs(d)} dias`;
}

export function ClienteCaptacaoTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: captures = [], isLoading } = useCaptures();
  const { data: scripts = [] } = useCaptureScripts();
  // Todos os envios deste cliente (todos os meses): a prontidão do histórico
  // precisa saber se cada gravação antiga foi revisada.
  const { data: envios = [] } = useScriptApprovalsTodos({ crmClientId: clientId });
  const hoje = hojeBR();

  // Só o que é DESTE cliente. O vínculo forte é o crm_client_id; pasta avulsa
  // (cliente fora do CRM) não entra aqui, porque ela não tem ficha.
  const minhas = useMemo(
    () => captures.filter((c) => c.crm_client_id === clientId).sort((a, b) => a.capture_date.localeCompare(b.capture_date)),
    [captures, clientId],
  );
  const meusRoteiros = useMemo(
    () => scripts.filter((s) => s.crm_client_id === clientId),
    [scripts, clientId],
  );

  const proxima = useMemo(
    () => minhas.find((c) => c.status === "agendada" && c.capture_date >= hoje) ?? null,
    [minhas, hoje],
  );
  // Histórico: mais recente primeiro, porque é assim que se procura ("quando foi
  // a última gravação dela?").
  const historico = useMemo(() => minhas.filter((c) => c !== proxima).slice().reverse(), [minhas, proxima]);
  const roteirosFeitos = meusRoteiros.filter((s) => s.done).length;

  const linkDoModulo = `/socialmidia/captacao?cliente=${encodeURIComponent(clientId)}`;

  if (isLoading) {
    return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm font-body text-muted-foreground">Carregando a captação…</div>;
  }

  return (
    <div className="space-y-4">
      {/* ── Próxima gravação: a única informação que a pessoa quer de cara ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--cria-verde))]/12 grid place-items-center shrink-0">
              <Camera className="h-5 w-5 text-[hsl(var(--cria-verde))]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground">Próxima gravação</p>
              {proxima ? (
                <>
                  <p className="text-lg font-display font-extrabold text-foreground leading-tight">
                    {dataCurta(proxima.capture_date)} <span className="text-sm font-semibold text-muted-foreground">· {quandoLabel(proxima.capture_date)}</span>
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
          <Button asChild className="shrink-0">
            <Link to={linkDoModulo}>{proxima ? "Abrir a pasta" : "Agendar gravação"} <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
          </Button>
        </div>
      </div>

      {/* ── Três números do cliente ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { rotulo: "Gravações", valor: minhas.length, icon: Camera },
          { rotulo: "Concluídas", valor: minhas.filter((c) => c.status === "concluida").length, icon: Check },
          { rotulo: "Roteiros", valor: meusRoteiros.length ? `${roteirosFeitos}/${meusRoteiros.length}` : "0", icon: FileText },
        ].map(({ rotulo, valor, icon: Icon }) => (
          <div key={rotulo} className="rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{rotulo}</span>
            </div>
            <p className="text-2xl font-display font-extrabold text-foreground leading-none mt-1.5">{valor}</p>
          </div>
        ))}
      </div>

      {/* ── Histórico: responde "quando foi a última vez que gravamos com ela?" ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Histórico de gravações
        </p>
        {historico.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground py-2">
            Nenhuma gravação registrada ainda. As que você marcar no Cria Captação aparecem aqui.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {historico.slice(0, 12).map((c) => {
              /* "Concluída" escondia o que interessa depois de gravar: se os
                 vídeos viraram post. A prontidão mostra os dois lados. */
              const p = prontidaoDa(c, scripts, envios);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-sm font-body font-semibold text-foreground shrink-0">{dataCurta(c.capture_date)}</span>
                  {c.location && <span className="text-xs font-body text-muted-foreground truncate">{c.location}</span>}
                  {p.detalhe && <span className="hidden sm:inline text-[11px] font-body text-muted-foreground truncate ml-auto">{p.detalhe}</span>}
                  <SeloProntidao p={p} className={p.detalhe ? "" : "ml-auto"} />
                </li>
              );
            })}
          </ul>
        )}
        {historico.length > 12 && (
          <p className="text-[11px] font-body text-muted-foreground mt-2">Mostrando as 12 mais recentes. O resto está na pasta do cliente.</p>
        )}
      </div>

      {/* O planejamento de rota mora no módulo de propósito: ele cruza clientes. */}
      <div className="rounded-2xl border border-dashed border-border p-4 flex items-center gap-3 flex-wrap">
        <p className="text-xs font-body text-muted-foreground flex-1 min-w-[240px]">
          Pra escrever roteiro, montar o guia de gravação em PDF e planejar a rota do dia (quem mais gravar na mesma ida),
          abra a pasta deste cliente no Cria Captação.
        </p>
        <Button variant="outline" asChild className="shrink-0">
          <Link to={linkDoModulo}>Abrir no Cria Captação</Link>
        </Button>
      </div>
    </div>
  );
}
