import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePillars, type Pillar } from "@/hooks/usePillars";
import { useProfile } from "@/hooks/useProfile";
import { sanitizeText } from "@/lib/sanitize";
import { confirmar } from "@/components/shared/Confirm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PILARES E LINHA EDITORIAL DA SEMANA (circuito 13, 16/09/2026)
   Pedido da Gabriela: "os pilares deveriam estar na parte de estratégia e não
   de configuração", e "lembra que no de social media a gente deixou um campo
   pra colocar descrição?".

   As duas coisas são a mesma coisa. O pilar estava em Configurações, ao lado de
   senha e tema, como se fosse ajuste de sistema. Ele é a decisão mais
   estratégica que o criador toma: sobre o que ele fala. Mudou de casa.

   E ganhou DESCRIÇÃO, pelo mesmo motivo que a linha editorial do cliente já
   tem no lado da social mídia: "Minha História" pode ser vulnerabilidade,
   bastidor ou trajetória. A palavra sozinha é rótulo; a descrição é o
   combinado, e é o que alguém relê na hora de escrever o post (ou o que a IA lê
   pra escrever no lugar).

   A descrição salva ao sair do campo, sem botão: é anotação, não formulário.
   Mesma gramática do LinhaEditorialItem do CRM.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Paleta ampliada (pedido do Walter, 31/08: "podia dar pra colocar mais
   cores"). Todas com contraste suficiente pro texto branco do chip. */
const PILLAR_COLORS = [
  "#7C3AED", // Roxo vibrante
  "#2563EB", // Azul elétrico
  "#0EA5E9", // Azul céu
  "#0891B2", // Ciano profundo
  "#0D9488", // Verde-água
  "#059669", // Verde esmeralda
  "#65A30D", // Verde lima
  "#D97706", // Amarelo âmbar
  "#EA580C", // Laranja queimado
  "#DC2626", // Vermelho coral
  "#E11D48", // Framboesa
  "#DB2777", // Rosa magenta
  "#9333EA", // Púrpura
  "#78716C", // Pedra (neutro)
];

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;

export function PilaresSection() {
  const { pillars, createPillar, updatePillar, deletePillar } = usePillars();
  const { profile, updateProfile } = useProfile();

  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(PILLAR_COLORS[0]);
  const [maisCores, setMaisCores] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");

  const [linha, setLinha] = useState<Record<string, string>>({});
  const [salvandoLinha, setSalvandoLinha] = useState(false);
  const hidratou = useRef(false);

  /* A linha editorial vem do perfil. `hidratou` existe pra ela não voltar pro
     valor do banco enquanto a pessoa mexe nos seletores. */
  useEffect(() => {
    if (hidratou.current || !profile) return;
    const bruto = profile.editorial_line;
    if (bruto && typeof bruto === "object") setLinha(bruto as Record<string, string>);
    hidratou.current = true;
  }, [profile]);

  const adicionar = async () => {
    const nome = sanitizeText(novoNome).trim();
    if (!nome) return;
    if (pillars.length >= 7) {
      toast.error("Sete pilares é o limite. Mais que isso vira lista de assuntos, não linha editorial.");
      return;
    }
    await createPillar.mutateAsync({ name: nome, color: novaCor });
    setNovoNome("");
  };

  const apagar = async (p: Pillar) => {
    const ok = await confirmar({
      titulo: `Apagar "${p.name}"?`,
      descricao: "Os posts que já usam este pilar ficam sem pilar. A descrição some junto.",
      acao: "Apagar",
    });
    if (ok) await deletePillar.mutateAsync(p.id);
  };

  const salvarNome = async (id: string) => {
    const nome = sanitizeText(editandoNome).trim();
    if (nome) await updatePillar.mutateAsync({ id, name: nome });
    setEditandoId(null);
  };

  const salvarLinha = async () => {
    if (salvandoLinha) return;
    setSalvandoLinha(true);
    try {
      await updateProfile.mutateAsync({ editorial_line: linha });
      toast.success("Linha editorial da semana salva.");
    } catch {
      toast.error("Não consegui salvar a linha editorial agora.");
    } finally {
      setSalvandoLinha(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── OS PILARES ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-[var(--shadow-warm)]">
        <h3 className="font-display font-semibold text-foreground">Pilares de conteúdo</h3>
        <p className="text-xs text-muted-foreground font-body mt-0.5 mb-4">
          Os assuntos que são seus. Máximo de sete: mais que isso vira lista de temas, não linha
          editorial. Escreva embaixo de cada um o que entra e o que não entra, porque a palavra
          sozinha quer dizer coisas diferentes em semanas diferentes.
        </p>

        <div className="space-y-2.5">
          {pillars.map((p) => (
            <PilarItem
              key={p.id}
              pilar={p}
              editando={editandoId === p.id}
              nomeEmEdicao={editandoNome}
              aoMudarNome={setEditandoNome}
              aoComecarEdicao={() => { setEditandoId(p.id); setEditandoNome(p.name); }}
              aoCancelarEdicao={() => setEditandoId(null)}
              aoSalvarNome={() => void salvarNome(p.id)}
              aoSalvarDescricao={(descricao) => updatePillar.mutate({ id: p.id, descricao })}
              aoApagar={() => void apagar(p)}
            />
          ))}
        </div>

        {pillars.length < 7 ? (
          <div className="space-y-2 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Novo pilar..." value={novoNome} maxLength={60}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void adicionar(); }}
                className="rounded-xl text-sm" />
              <Button variant="outline" size="sm" type="button" onClick={() => void adicionar()}
                disabled={createPillar.isPending} aria-label="Adicionar pilar">
                {createPillar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {(maisCores ? PILLAR_COLORS : PILLAR_COLORS.slice(0, 7)).map((c) => (
                <button key={c} type="button" onClick={() => setNovaCor(c)} aria-label={`Cor ${c}`}
                  className={cn("w-6 h-6 rounded-full transition-all", novaCor === c && "ring-2 ring-offset-2 ring-primary")}
                  style={{ backgroundColor: c }} />
              ))}
              <button type="button" onClick={() => setMaisCores((v) => !v)}
                className="h-6 px-2 rounded-full border border-dashed border-border text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors">
                {maisCores ? "menos" : `+${PILLAR_COLORS.length - 7} cores`}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] font-body text-muted-foreground mt-4">
            Sete pilares, o limite. Pra trocar um, apague outro antes.
          </p>
        )}
      </div>

      {/* ── A SEMANA ───────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-[var(--shadow-warm)]">
        <h3 className="font-display font-semibold text-foreground">Linha editorial da semana</h3>
        <p className="text-xs text-muted-foreground font-body mt-0.5 mb-4">
          Qual pilar trabalhar em cada dia. Não é obrigação: é o padrão que evita a segunda-feira
          começar no vazio.
        </p>

        {pillars.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body">
            Cadastre pelo menos um pilar acima pra montar a semana.
          </p>
        ) : (
          <>
            {/* Duas colunas no celular, sete no desktop: sete seletores de 48px
                não cabem em 390px (lição do circuito 10). */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {DIAS.map((dia) => (
                <div key={dia} className="flex flex-col gap-1">
                  <label className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">
                    {dia}
                  </label>
                  <select value={linha[dia] ?? ""}
                    onChange={(e) => setLinha((prev) => ({ ...prev, [dia]: e.target.value }))}
                    className="rounded-lg border border-border bg-card text-xs font-body p-2 min-h-[38px]">
                    <option value="">-</option>
                    {pillars.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <Button type="button" size="sm" onClick={() => void salvarLinha()} disabled={salvandoLinha}>
                {salvandoLinha ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── UM PILAR ──────────────────────────────────────────────────────────────
   Nome editável no lápis, descrição sempre à vista. A descrição fica visível
   mesmo vazia, com o convite escrito no placeholder: campo escondido atrás de
   um clique é campo que ninguém preenche. */
function PilarItem({
  pilar, editando, nomeEmEdicao, aoMudarNome, aoComecarEdicao, aoCancelarEdicao,
  aoSalvarNome, aoSalvarDescricao, aoApagar,
}: {
  pilar: Pillar;
  editando: boolean;
  nomeEmEdicao: string;
  aoMudarNome: (v: string) => void;
  aoComecarEdicao: () => void;
  aoCancelarEdicao: () => void;
  aoSalvarNome: () => void;
  aoSalvarDescricao: (descricao: string) => void;
  aoApagar: () => void;
}) {
  const [desc, setDesc] = useState(pilar.descricao ?? "");
  const salvo = useRef(pilar.descricao ?? "");

  useEffect(() => {
    setDesc(pilar.descricao ?? "");
    salvo.current = pilar.descricao ?? "";
  }, [pilar.descricao]);

  const salvarAoSair = () => {
    if (desc.trim() === salvo.current.trim()) return;
    salvo.current = desc;
    aoSalvarDescricao(desc);
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2.5">
        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: pilar.color }} />
        {editando ? (
          <div className="flex items-center gap-2 flex-1">
            <input autoFocus value={nomeEmEdicao} maxLength={60}
              onChange={(e) => aoMudarNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aoSalvarNome();
                if (e.key === "Escape") aoCancelarEdicao();
              }}
              className="flex-1 h-8 px-2 rounded-lg border border-primary/40 bg-card text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <button type="button" onClick={aoSalvarNome} className="text-xs text-primary font-body font-medium hover:underline">Salvar</button>
            <button type="button" onClick={aoCancelarEdicao} className="text-xs text-muted-foreground font-body hover:underline">Cancelar</button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm font-body font-semibold text-foreground">{pilar.name}</span>
            <button type="button" onClick={aoComecarEdicao} aria-label={`Renomear ${pilar.name}`}
              className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={aoApagar} aria-label={`Apagar ${pilar.name}`}
              className="h-8 w-8 grid place-items-center rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <Textarea rows={2} value={desc} maxLength={600}
        onChange={(e) => setDesc(e.target.value)} onBlur={salvarAoSair}
        placeholder="O que entra neste pilar, o que evitar, exemplos. Quem escrever o post depois vai reler isto."
        className="mt-2 rounded-xl text-[12.5px] font-body resize-y" />
    </div>
  );
}
