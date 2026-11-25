import { useState } from "react";
import { Loader2, Unplug } from "lucide-react";
import { Selo } from "@/components/settings/ConfigShell";
import { FotoComSelo, LogoRede } from "@/components/shared/LogoRede";
import { Button } from "@/components/ui/button";
import {
  conectarRede, estadoConexaoRede, NOME_REDE, useConexoesProprias, useDesconectarRede,
  type ConexaoPropria, type RedeNova, useVoltaDoLoginDaRede,
} from "@/hooks/usePublicarRedes";

/* ═══════════════════════════════════════════════════════════════════════════
   REDES PRA PUBLICAR (Configurações > Conexões). Mockup aprovado em 25/11/2026.

   Walter, 25/11/2026: "precisamos ajustar a conexao com o youtube, a conexao
   com linkedin etc". Ele não achava onde conectar o YouTube: só dava por
   dentro do post. Aqui ficam as contas DA conta (as dos clientes continuam na
   ficha do cliente). Só o master vê enquanto a publicação está em teste; o
   redes-oauth também barra quem não é master.
   Substitui o cartão ConexaoYouTubeSoMaster que entrou na main no mesmo dia:
   uma tela só de redes (mockup aprovado).
   ═══════════════════════════════════════════════════════════════════════════ */

const ORDEM: RedeNova[] = ["youtube", "tiktok", "linkedin"];

const dataCurta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

/* Padrão Cria (Walter, 25/11/2026: "unifique elas por favor pra ficar um
   padrao Cria"): cada rede usa a mesma linha do Instagram conectado (fundo
   laranja claro, borda, avatar de 40px, botões iguais) e os avisos viram os
   selos do resumo de Configurações, sem caixa amarela solta. */
function BlocoRede({ rede, c, onDesconectar, desconectando }: { rede: RedeNova; c: ConexaoPropria | null; onDesconectar: () => void; desconectando: boolean }) {
  const [indo, setIndo] = useState(false);
  const nome = NOME_REDE[rede];
  const conectar = async () => { setIndo(true); await conectarRede(rede, null); setIndo(false); };
  const est = c ? estadoConexaoRede(c) : null;
  const alerta = !!est && (est.vencida || est.perto);

  if (!c) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <LogoRede marca={rede} />
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">{nome}</p>
            <p className="text-xs font-body text-muted-foreground">Não conectado</p>
          </div>
        </div>
        <Button variant="hero" size="sm" disabled={indo} onClick={() => void conectar()} className="w-full sm:w-auto">
          {indo ? <Loader2 className="h-4 w-4 animate-spin" /> : `Conectar ${nome}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
      <div className="flex items-center gap-3 min-w-0">
        {c.profile_picture_url ? <FotoComSelo src={c.profile_picture_url} marca={rede} /> : <LogoRede marca={rede} />}
        <div className="min-w-0">
          <p className="text-sm font-body font-semibold text-foreground truncate">{c.username ?? nome}</p>
          <p className="text-xs font-body text-muted-foreground flex flex-wrap items-center gap-1">
            {nome} ·{" "}
            {est?.vencida ? <Selo tom="alerta">conexão vencida</Selo>
              : est?.perto ? <Selo tom="alerta">vence em {Math.max(est.dias ?? 0, 0)} dia{est.dias === 1 ? "" : "s"}</Selo>
              : <>Conectado{rede === "linkedin" && est?.venceEm ? ` · vale até ${dataCurta(est.venceEm)}` : ""}</>}
          </p>
        </div>
      </div>
      <div className="flex gap-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
        {alerta && (
          <Button variant="hero" size="sm" disabled={indo} onClick={() => void conectar()}>
            {indo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reconectar"}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={desconectando} onClick={onDesconectar}><Unplug className="h-4 w-4 mr-2" /> Desconectar</Button>
      </div>
      {alerta && (
        <p className="w-full text-xs font-body text-muted-foreground leading-snug">
          {rede === "linkedin" ? "O LinkedIn não renova sozinho: a cada 60 dias você reconecta. " : ""}
          Posts agendados pro {nome} ficam parados até reconectar.
        </p>
      )}
    </div>
  );
}

export function RedesParaPublicar({ userId }: { userId: string | null | undefined }) {
  const lista = useConexoesProprias(userId);
  const desconectar = useDesconectarRede(userId);

  // Volta do login da rede: avisa, recarrega as conexões e limpa a URL.
  useVoltaDoLoginDaRede();

  const porRede = (r: RedeNova) => (lista.data ?? []).find((c) => c.provider === r) ?? null;

  return (
    <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
      <h3 className="font-display font-semibold text-foreground flex flex-wrap items-center gap-2">
        Redes pra publicar <Selo tom="neutro">teste · só master</Selo>
      </h3>
      <p className="text-sm text-muted-foreground font-body leading-relaxed">Ligue as contas onde o Cria vai publicar por você. Cada rede pede o login dela uma vez.</p>
      {lista.isLoading
        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : (
          <div className="space-y-3">
            {ORDEM.map((r) => {
              const c = porRede(r);
              return <BlocoRede key={r} rede={r} c={c} desconectando={desconectar.isPending} onDesconectar={() => c && desconectar.mutate(c)} />;
            })}
          </div>
        )}
    </div>
  );
}
