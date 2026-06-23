import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCrmClients, useCreateCrmContract } from "@/hooks/useCrm";
import { useManagerProfile } from "@/hooks/useModules";
import { usePdfExport } from "@/hooks/usePdfExport";
import { ContractPdfTemplate, type ContractData } from "@/components/pdf/ContractPdfTemplate";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().split("T")[0];
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function ContractGeneratorDialog({ open, onOpenChange }: Props) {
  const { data: clients = [] } = useCrmClients();
  const { profile } = useManagerProfile();
  const createContract = useCreateCrmContract();
  const { exportPdf } = usePdfExport();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const company = profile?.contract_company ?? {};
  const [d, setD] = useState<ContractData>(() => baseData(company));
  const set = (patch: Partial<ContractData>) => setD((x) => ({ ...x, ...patch }));

  // reset defaults ao abrir
  useEffect(() => { if (open) { setClientId(""); setD(baseData(profile?.contract_company ?? {})); } }, [open, profile]);

  // ao escolher cliente, pré-preenche o lado CONTRATANTE
  useEffect(() => {
    const cl = clients.find((c) => c.id === clientId);
    if (!cl) return;
    setD((x) => ({
      ...x,
      ctName: cl.name ?? "", repName: cl.name ?? "", repEmail: cl.email ?? "", repPhone: cl.phone ?? "",
      value: cl.monthly_value ? String(cl.monthly_value) : x.value,
      startDate: cl.contract_date ?? x.startDate,
    }));
  }, [clientId, clients]);

  const clientName = clients.find((c) => c.id === clientId)?.name ?? d.ctName;

  const generate = async () => {
    setBusy(true);
    try {
      // Captura em tamanho natural (zoom 1) — o html2canvas quebra o texto com zoom != 1.
      setCapturing(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await new Promise((r) => setTimeout(r, 60));
      await exportPdf(pdfRef, `contrato-${slug(clientName || "cliente")}`);
      setCapturing(false);
      await createContract.mutateAsync({
        title: `Contrato - ${clientName || "cliente"}`,
        crm_client_id: clientId || null,
        status: "enviado",
        monthly_value: Number(d.value) || 0,
        contract_value: Number(d.value) || 0,
        sent_date: today(),
      });
      toast.success("Contrato gerado e baixado!");
      onOpenChange(false);
    } catch (e) {
      console.error(e); toast.error("Erro ao gerar o contrato.");
    } finally { setBusy(false); setCapturing(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Gerar contrato</DialogTitle>
            <DialogDescription className="font-body text-sm">Modelo base de gerenciamento de redes sociais. Revise os campos antes de enviar.</DialogDescription>
          </DialogHeader>

          {(!company.legalName) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2.5 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Preencha “Dados da minha empresa” em Configurações pra qualificar a CONTRATADA.
            </div>
          )}

          <div className="space-y-5 mt-2">
            <Sec title="Cliente (CONTRATANTE)">
              <Fld label="Selecionar cliente da carteira (opcional)" full>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="">— preencher manualmente —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Fld>
              <Grid>
                <Fld label="Razão social / nome" full><Input value={d.ctName} onChange={(e) => set({ ctName: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="CNPJ / CPF"><Input value={d.ctDoc} onChange={(e) => set({ ctDoc: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="CEP"><Input value={d.ctCep} onChange={(e) => set({ ctCep: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Endereço" full><Input value={d.ctAddress} onChange={(e) => set({ ctAddress: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Cidade"><Input value={d.ctCity} onChange={(e) => set({ ctCity: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="UF"><Input value={d.ctUf} maxLength={2} onChange={(e) => set({ ctUf: e.target.value })} className="rounded-xl" /></Fld>
              </Grid>
            </Sec>

            <Sec title="Escopo dos serviços">
              <Grid>
                <Fld label="Rede social"><Input value={d.socialNetwork} onChange={(e) => set({ socialNetwork: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Publicações/mês"><Input type="number" value={d.postsPerMonth} onChange={(e) => set({ postsPerMonth: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Carrosséis"><Input type="number" value={d.carrosseis} onChange={(e) => set({ carrosseis: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Vídeos"><Input type="number" value={d.videos} onChange={(e) => set({ videos: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Horas de gravação/mês"><Input type="number" value={d.recHours} onChange={(e) => set({ recHours: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Reuniões/mês"><Input type="number" value={d.meetings} onChange={(e) => set({ meetings: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Atendimento (horário)" full><Input value={d.supportHours} onChange={(e) => set({ supportHours: e.target.value })} className="rounded-xl" /></Fld>
              </Grid>
              <div className="flex gap-4 mt-1">
                <Chk label="Edição de reels" v={d.reelsEdit} on={(b) => set({ reelsEdit: b })} />
                <Chk label="Relatório de métricas" v={d.report} on={(b) => set({ report: b })} />
              </div>
            </Sec>

            <Sec title="Preço e prazo">
              <Grid>
                <Fld label="Valor mensal (R$)"><Input value={d.value} onChange={(e) => set({ value: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Valor por extenso (opcional)"><Input value={d.valueExtenso} onChange={(e) => set({ valueExtenso: e.target.value })} placeholder="mil reais" className="rounded-xl" /></Fld>
                <Fld label="Dia de vencimento"><Input type="number" value={d.dueDay} onChange={(e) => set({ dueDay: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Multa de rescisão (%)"><Input type="number" value={d.multaPct} onChange={(e) => set({ multaPct: Number(e.target.value) })} className="rounded-xl" /></Fld>
                <Fld label="Duração"><Input value={d.termText} onChange={(e) => set({ termText: e.target.value })} placeholder="3 meses" className="rounded-xl" /></Fld>
                <Fld label="Início"><Input type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} className="rounded-xl" /></Fld>
              </Grid>
              <div className="mt-1"><Chk label="Renovação automática" v={d.autoRenew} on={(b) => set({ autoRenew: b })} /></div>
            </Sec>

            <Sec title="Representante para contato (CONTRATANTE)">
              <Grid>
                <Fld label="Nome"><Input value={d.repName} onChange={(e) => set({ repName: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Cargo"><Input value={d.repRole} onChange={(e) => set({ repRole: e.target.value })} placeholder="Proprietária" className="rounded-xl" /></Fld>
                <Fld label="E-mail"><Input value={d.repEmail} onChange={(e) => set({ repEmail: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Telefone"><Input value={d.repPhone} onChange={(e) => set({ repPhone: e.target.value })} className="rounded-xl" /></Fld>
              </Grid>
            </Sec>

            <Sec title="Foro, assinatura e testemunhas">
              <Grid>
                <Fld label="Foro — cidade"><Input value={d.foroCity} onChange={(e) => set({ foroCity: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Foro — UF"><Input value={d.foroUf} maxLength={2} onChange={(e) => set({ foroUf: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Cidade da assinatura"><Input value={d.signCity} onChange={(e) => set({ signCity: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Data da assinatura"><Input type="date" value={d.signDate} onChange={(e) => set({ signDate: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Testemunha 1 (nome)"><Input value={d.witness1} onChange={(e) => set({ witness1: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Testemunha 2 (nome)"><Input value={d.witness2} onChange={(e) => set({ witness2: e.target.value })} className="rounded-xl" /></Fld>
              </Grid>
            </Sec>
          </div>

          {/* Pré-visualização — também é a FONTE do PDF (precisa ficar em fluxo e visível) */}
          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização do contrato</p>
            <div className="rounded-xl border border-border bg-muted/30 overflow-auto" style={{ maxHeight: "55vh" }}>
              <div style={{ zoom: capturing ? 1 : 0.72 } as CSSProperties}>
                <ContractPdfTemplate ref={pdfRef} data={{ ...d, company }} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={generate} disabled={busy || !d.ctName.trim()}>{busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}Baixar contrato (PDF)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function baseData(company: import("@/hooks/useModules").ContractCompany): ContractData {
  return {
    company, socialNetwork: "Instagram",
    ctName: "", ctDoc: "", ctAddress: "", ctCep: "", ctCity: "", ctUf: "",
    postsPerMonth: 6, carrosseis: 3, videos: 3, recHours: 2, reelsEdit: true, meetings: 2, report: true,
    supportHours: "das 9h às 19h, de segunda a sexta-feira",
    value: "", valueExtenso: "", dueDay: 10,
    termText: "3 meses", startDate: today(), autoRenew: true, multaPct: 20,
    foroCity: company.city ?? "", foroUf: company.uf ?? "",
    repName: "", repRole: "", repEmail: "", repPhone: "",
    signCity: company.city ?? "", signDate: today(), witness1: "", witness2: "",
  };
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</section>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
function Fld({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label>{children}</div>;
}
function Chk({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return <button type="button" onClick={() => on(!v)} className={cn("flex items-center gap-2 text-sm font-body", v ? "text-foreground" : "text-muted-foreground")}>
    <span className={cn("w-4 h-4 rounded border flex items-center justify-center text-[10px]", v ? "bg-primary border-primary text-primary-foreground" : "border-border")}>{v ? "✓" : ""}</span>{label}
  </button>;
}
