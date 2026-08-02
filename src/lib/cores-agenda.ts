// Regra ÚNICA de cor dos itens da agenda (tarefas, captações, materiais).
//
// Vivia dentro de src/pages/socialmidia/AgendaCriacao.tsx e agora mora aqui pra
// a aba Tarefas do Cria Gestão pintar os cards exatamente com a mesma regra,
// em vez de cada tela inventar a sua. O comportamento não mudou.
import type { CrmTask } from "@/hooks/useCrm";

// Cores padrão de cada tipo, usadas só quando nem o item nem o dono dele têm cor.
export const TASK_CLIENT_DEFAULT_COLOR = "#01A652"; // verde, tarefa de cliente
export const LEAD_DEFAULT_COLOR = "#0061EE";        // azul, tarefa de lead

// Cor efetiva de um item da agenda, em ordem de prioridade:
//   1) a cor escolhida no PRÓPRIO item (a tarefa, quando você define uma)
//   2) a cor do DONO dele (o cliente cadastrado, ou o lead)
//   3) a cor padrão do tipo
// Antes a tarefa de lead era forçada em azul e a captação em teal, ignorando a
// cor escolhida. Resultado: você pintava de roxo e o card continuava azul.
export function corDoItem(corPropria: string | null | undefined, corDono: string | null | undefined, padrao: string): string {
  const propria = corPropria?.trim();
  if (propria) return propria;
  const dono = corDono?.trim();
  if (dono) return dono;
  return padrao;
}

// Só o que a regra precisa saber do dono (cliente ou lead).
type DonoComCor = { id: string; color: string | null };

/** Cor de qualquer TAREFA: a dela, senão a do lead ou do cliente, senão o padrão do tipo. */
export function corDaTarefa(t: CrmTask, clients: DonoComCor[], leads: DonoComCor[]): string {
  const corDono = t.crm_lead_id
    ? leads.find((l) => l.id === t.crm_lead_id)?.color ?? null
    : (t.crm_client_id ? clients.find((c) => c.id === t.crm_client_id)?.color ?? null : null);
  return corDoItem(t.color, corDono, t.crm_lead_id ? LEAD_DEFAULT_COLOR : TASK_CLIENT_DEFAULT_COLOR);
}
