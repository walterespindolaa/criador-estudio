import { forwardRef } from "react";
import type { ContractCompany } from "@/hooks/useModules";

export type ContractData = {
  company: ContractCompany;
  socialNetwork: string;
  ctName: string; ctDoc: string; ctAddress: string; ctCep: string; ctCity: string; ctUf: string;
  postsPerMonth: number; carrosseis: number; videos: number;
  recHours: number; reelsEdit: boolean; meetings: number; report: boolean; supportHours: string;
  value: string; valueExtenso: string; dueDay: number;
  termText: string; startDate: string; autoRenew: boolean;
  multaPct: number;
  foroCity: string; foroUf: string;
  repName: string; repRole: string; repEmail: string; repPhone: string;
  signCity: string; signDate: string;
  witness1: string; witness2: string;
};

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const fmtLong = (iso?: string) => {
  if (!iso) return "____ de __________ de ____";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

const sPage: React.CSSProperties = { width: 794, background: "#fff", color: "#1a1a1a", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 13, lineHeight: 1.65, padding: "56px 64px", boxSizing: "border-box" };
const sH: React.CSSProperties = { fontSize: 13, fontWeight: 700, marginTop: 22, marginBottom: 6, textTransform: "uppercase" };
const sP: React.CSSProperties = { textAlign: "justify", margin: "0 0 10px" };
const sLi: React.CSSProperties = { textAlign: "justify", margin: "0 0 5px" };

export const ContractPdfTemplate = forwardRef<HTMLDivElement, { data: ContractData }>(({ data: d }, ref) => {
  const c = d.company ?? {};
  const isPj = (c.personType ?? "pj") === "pj";
  const contratada = isPj
    ? `${c.legalName || "____"}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.document || "____"}, com sede na ${c.address || "____"}${c.cep ? `, CEP ${c.cep}` : ""}, ${c.city || "____"}/${c.uf || "__"}, neste ato representada por ${c.repName || "____"}${c.repNationality ? `, ${c.repNationality}` : ""}${c.repProfession ? `, ${c.repProfession}` : ""}${c.repRg ? `, portador(a) da cédula de identidade nº ${c.repRg}` : ""}${c.repCpf ? `, inscrito(a) no CPF sob nº ${c.repCpf}` : ""}, doravante denominada CONTRATADA;`
    : `${c.legalName || "____"}, inscrito(a) no CPF sob o nº ${c.document || "____"}, residente e domiciliado(a) na ${c.address || "____"}${c.cep ? `, CEP ${c.cep}` : ""}, ${c.city || "____"}/${c.uf || "__"}, doravante denominado(a) CONTRATADA;`;
  const contratante = `${d.ctName || "____"}, inscrita no CNPJ/CPF sob o nº ${d.ctDoc || "____"}, com sede na ${d.ctAddress || "____"}${d.ctCep ? `, CEP ${d.ctCep}` : ""}, ${d.ctCity || "____"}/${d.ctUf || "__"}, doravante denominada CONTRATANTE;`;
  const valor = `R$ ${d.value || "____"}${d.valueExtenso ? ` (${d.valueExtenso})` : ""}`;

  return (
    <div ref={ref} style={sPage}>
      <p style={{ textAlign: "center", fontWeight: 700, fontSize: 16, marginBottom: 22 }}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</p>
      <p style={sP}>Pelo presente instrumento particular, e na melhor forma de direito, as partes a seguir qualificadas:</p>

      <p style={sH}>1. Das Partes</p>
      <p style={sP}>De um lado, {contratada}</p>
      <p style={sP}>E, de outro lado, {contratante}</p>
      <p style={sP}>Têm entre si, justas e contratadas, o presente Contrato de Prestação de Serviços de Gerenciamento de Redes Sociais, que se regerá pelas cláusulas e condições seguintes.</p>

      <p style={sH}>2. Objeto</p>
      <p style={sP}>O presente instrumento tem como objeto a prestação de serviços digitais, no formato on-line, para gerenciamento da rede social “{d.socialNetwork || "Instagram"}”, abrangendo a criação da estratégia, monitoramento, gerenciamento e publicação de postagens.</p>

      <p style={sH}>3. Da Prestação dos Serviços</p>
      <p style={sP}>A gestão da rede social “{d.socialNetwork || "Instagram"}” abrangerá os seguintes serviços:</p>
      <p style={sLi}>a) Estratégia de conteúdo, envolvendo planejamento estratégico, posicionamento, objetivos e linha editorial;</p>
      <p style={sLi}>b) Execução de {d.postsPerMonth} publicações mensais (a depender da estratégia do mês, esses números podem variar), distribuídas em {d.carrosseis} carrosséis e {d.videos} vídeos;</p>
      <p style={sLi}>c) {d.recHours} horas de gravações mensais;</p>
      {d.reelsEdit && <p style={sLi}>d) Edição de reels;</p>}
      <p style={sLi}>{d.reelsEdit ? "e" : "d"}) Até {d.meetings} reuniões mensais;</p>
      {d.report && <p style={sLi}>{d.reelsEdit ? "f" : "e"}) Envio de relatório de métricas ao final de cada mês;</p>}
      <p style={sLi}>{(d.reelsEdit ? 1 : 0) + (d.report ? 1 : 0) === 2 ? "g" : (d.reelsEdit || d.report ? "f" : "e")}) Atendimento via WhatsApp {d.supportHours || "das 9h às 19h, de segunda a sexta-feira"}.</p>
      <p style={sP}>Todas as publicações deverão ser, previamente, avaliadas e aprovadas pela CONTRATANTE.</p>

      <p style={sH}>4. Planejamento de Conteúdo</p>
      <p style={sLi}>a) A CONTRATANTE é livre para sugerir conteúdo informativo de suas páginas, sendo integralmente responsável pelos efeitos dessas informações, respondendo civil e criminalmente por atos contrários à lei, propaganda enganosa, atos obscenos e violação de direitos autorais.</p>
      <p style={sLi}>b) A CONTRATADA fica autorizada a utilizar o conteúdo produzido nas plataformas e formatos disponibilizados.</p>
      <p style={sLi}>c) A CONTRATADA enviará as publicações até três dias antes da data de postagem, para aprovação da CONTRATANTE.</p>
      <p style={sLi}>d) Alterações poderão ser solicitadas via WhatsApp; o prazo de conclusão será ajustado de comum acordo conforme a complexidade da demanda.</p>
      <p style={sLi}>e) O prazo para início das postagens é de 15 dias úteis a contar da reunião de briefing, período em que serão entregues a estratégia, o posicionamento e o cronograma para aprovação.</p>
      <p style={sP}>4.1. A CONTRATANTE deverá fornecer acessos das contas gerenciadas, materiais (fotos e vídeos), aprovar o calendário em até 5 dias e adotar as estratégias formuladas. Parágrafo único: eventuais metas são estimadas, podendo variar conforme a estratégia adotada de comum acordo.</p>

      <p style={sH}>5. Preços e Pagamentos</p>
      <p style={sP}>Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA a importância de {valor}, com vencimento no dia {d.dueDay} de cada mês.</p>
      <p style={sP}>Parágrafo primeiro: o atraso implicará multa moratória de 2% sobre o valor devido, juros de mora de 1% ao mês (pro rata die) e correção pelo IGPM/FGV até o efetivo pagamento.</p>
      <p style={sP}>Parágrafo segundo: não havendo provimento dos requisitos ou pagamento, os trabalhos serão suspensos e retomados após a regularização, acrescido das multas e perdas e danos, se houver.</p>

      <p style={sH}>6. Prazo</p>
      <p style={sP}>O prazo de vigência será de {d.termText || "____"} a contar de {fmtLong(d.startDate)}{d.autoRenew ? ", podendo ser renovado, de forma automática, por iguais e sucessivos períodos." : ", sem renovação automática."}</p>

      <p style={sH}>7. Rescisão</p>
      <p style={sP}>Caso a CONTRATANTE opte por rescindir o contrato antes do término do prazo, sem justa causa, pagará à CONTRATADA multa compensatória equivalente a {d.multaPct}% do valor total dos serviços restantes até o final do contrato.</p>
      <p style={sP}>Parágrafo primeiro: a multa não será devida em caso de rescisão por descumprimento contratual comprovado da CONTRATADA. Parágrafo segundo: após o prazo e em caso de renovação, qualquer das partes poderá rescindir mediante comunicação escrita com 30 dias de antecedência.</p>

      <p style={sH}>8. Sigilo / Confidencialidade</p>
      <p style={sP}>Toda informação transferida entre as partes será considerada confidencial e não poderá ser divulgada a terceiros sem prévia e expressa autorização.</p>

      <p style={sH}>9. Da Propriedade Intelectual</p>
      <p style={sP}>A CONTRATADA não disponibiliza os arquivos abertos do conteúdo criado para modificação pela CONTRATANTE.</p>

      <p style={sH}>10. Disposições Finais</p>
      <p style={sLi}>a) A CONTRATADA não se responsabiliza por perdas ou prejuízos decorrentes de ataques de terceiros ou situações fora de seu controle.</p>
      <p style={sLi}>b) As partes atuarão em conformidade com a legislação de proteção de dados, em especial a Lei nº 13.709/2018 (LGPD).</p>

      <p style={sH}>11. Foro</p>
      <p style={sP}>As partes elegem o foro de {d.foroCity || "____"} - {d.foroUf || "__"} para dirimir eventuais dúvidas oriundas deste instrumento, com renúncia a qualquer outro.</p>

      <p style={sH}>12. Do Representante para Contato</p>
      <p style={sP}>Para fins de comunicação e aprovação de demandas, a CONTRATANTE indica como representante {d.repName || "____"}{d.repRole ? `, ${d.repRole}` : ""}{d.repEmail ? `, e-mail ${d.repEmail}` : ""}{d.repPhone ? `, telefone ${d.repPhone}` : ""}. Qualquer alteração deverá ser comunicada formalmente, por escrito, com 2 dias úteis de antecedência.</p>

      <p style={{ ...sP, marginTop: 18 }}>E, por estarem assim justas e contratadas, firmam o presente em duas vias de igual teor e forma, juntamente com as testemunhas abaixo.</p>
      <p style={{ textAlign: "center", margin: "18px 0 28px" }}>{d.signCity || "____"}, {fmtLong(d.signDate)}.</p>

      <div style={{ marginBottom: 22 }}>
        <p style={{ margin: 0 }}>_______________________________________</p>
        <p style={{ margin: 0, fontWeight: 700 }}>{c.legalName || "CONTRATADA"}</p>
        {isPj && c.document && <p style={{ margin: 0 }}>CNPJ nº {c.document}</p>}
        {isPj && c.repName && <p style={{ margin: 0 }}>Representante: {c.repName}</p>}
      </div>
      <div style={{ marginBottom: 22 }}>
        <p style={{ margin: 0 }}>_______________________________________</p>
        <p style={{ margin: 0, fontWeight: 700 }}>{d.ctName || "CONTRATANTE"}</p>
        {d.ctDoc && <p style={{ margin: 0 }}>CNPJ/CPF nº {d.ctDoc}</p>}
      </div>
      <p style={{ margin: "10px 0 4px" }}>Testemunha 1: _____________________________  Nome: {d.witness1 || ""}</p>
      <p style={{ margin: "10px 0 4px" }}>Testemunha 2: _____________________________  Nome: {d.witness2 || ""}</p>
    </div>
  );
});
ContractPdfTemplate.displayName = "ContractPdfTemplate";
