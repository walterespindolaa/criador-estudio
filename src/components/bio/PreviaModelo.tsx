import { useId } from "react";
import { SiteBio, type ItemLite } from "@/components/bio/SiteBio";
import { EmPreviaContext } from "@/components/bio/SiteLoja";
import { corDeDestaque } from "@/lib/bioBlocks";
import type { AparenciaModelo, BlocoDoModelo, PreviaDoModelo } from "@/lib/bioTemplates";

/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DE UM MODELO (21/10/2026)

   Antes cada modelo era um desenho de três barrinhas coloridas, e os quatro
   pareciam iguais: a pessoa escolhia no escuro e só via o resultado depois de
   aplicar. Aqui o modelo é montado com o MESMO SiteBio da página pública, com
   o texto de exemplo dele, antes de aplicar nada.

   O site se monta pela largura da moldura (container queries), então ele é
   desenhado sempre em 300px, a largura de um celular, e só a escala muda: na
   miniatura do card fica pequeno, na janela de prévia fica do tamanho real.
   ═══════════════════════════════════════════════════════════════════════════ */

const LARGURA = 300;

/** Serviço e post de exemplo: sem eles o modelo de loja e o de autoridade
 *  apareciam sem a seção principal, porque ela puxa o que a pessoa cadastrou. */
const EXEMPLO_ITENS = (tipo: string, nomes: string[], preco: boolean): ItemLite[] =>
  nomes.map((titulo, i) => ({
    id: `${tipo}-${i}`, tipo, slug: `${tipo}-${i}`, titulo,
    resumo: "Texto de exemplo. Aqui entra o que você cadastrar.",
    capa: null, preco: preco ? [180, 250, 90][i] ?? null : null, preco_texto: null,
    publicado_em: "2026-10-01T12:00:00Z",
  }));
const PRODUTOS = EXEMPLO_ITENS("produto", ["Seu primeiro serviço", "Pacote completo", "Avulso"], true);
const POSTS = EXEMPLO_ITENS("post", ["Como escolher o melhor pra você", "3 erros que todo mundo comete"], false);

/** Foto de exemplo na capa: sem ela a capa sai como um bloco liso e a prévia
 *  não mostra o que o modelo é. Só existe na prévia; o modelo aplicado entra
 *  sem foto, porque a foto tem que ser da pessoa. */
export const FOTO_EXEMPLO = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=70";
export const FOTO_EXEMPLO_SAUDE = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=700&q=70";

const RAIO: Record<AparenciaModelo["buttonStyle"], string> = {
  pill: "rounded-full", square: "rounded-none", rounded: "rounded-xl", outline: "rounded-xl",
};

const pilha = (fonte: string) =>
  /serif|display/i.test(fonte) && !/sans/i.test(fonte) ? `'${fonte}', Georgia, serif` : `'${fonte}', system-ui, sans-serif`;

export function PreviaModelo({ blocos, aparencia, escala = 1, altura, foto = FOTO_EXEMPLO, previa }: {
  blocos: BlocoDoModelo[];
  /** Dados de exemplo SÓ desta prévia (números, preços, Instagram de mentira).
   *  Nunca entram na página de ninguém: o modelo aplicado leva só `blocos`. */
  previa?: PreviaDoModelo;
  foto?: string;
  aparencia: AparenciaModelo;
  /** 1 = tamanho de celular. A miniatura usa uns 0.32. */
  escala?: number;
  /** Altura visível já na escala final. Sem ela, mostra a página inteira. */
  altura?: number;
}) {
  // Classe própria por prévia: a fonte de um modelo não pode vazar pro outro
  // card nem pro editor em volta.
  const escopo = `pm-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const lite = blocos.map((b, i) => {
    const data = { ...(b.data ?? {}), ...(previa?.blocos?.[i] ?? {}) };
    if ((b.kind === "capa" || b.kind === "apresentacao") && !data.imagem) {
      data.imagem = foto;
      if (b.kind === "apresentacao") data.midia = "imagem";
    }
    return { id: `${escopo}-${i}`, kind: b.kind, data, position: i };
  });

  return (
    <div aria-hidden className="overflow-hidden relative"
      style={{ width: LARGURA * escala, height: altura }}>
      <style>{`.${escopo},.${escopo} *:not(.bio-fonte-livre){font-family:${pilha(aparencia.fontFamily)} !important}`
        + (aparencia.fontTitulos ? `.${escopo} .font-display:not(.bio-fonte-livre),.${escopo} h1:not(.bio-fonte-livre),.${escopo} h2:not(.bio-fonte-livre),.${escopo} h3:not(.bio-fonte-livre){font-family:${pilha(aparencia.fontTitulos)} !important}` : "")}</style>
      <div className={escopo}
        // inert: é desenho. Nada dentro dele recebe clique ou foco.
        {...{ inert: "" }}
        style={{ width: LARGURA, transform: escala === 1 ? undefined : `scale(${escala})`, transformOrigin: "top left" }}>
        <EmPreviaContext.Provider value={true}>
        <SiteBio
          blocos={lite}
          marca={{ nome: "Seu nome", logo: null, cor: corDeDestaque(aparencia.buttonColor), corTexto: aparencia.buttonTextColor }}
          produtos={PRODUTOS} posts={POSTS} social={previa?.social ?? null}
          visual={{
            buttonColor: aparencia.buttonColor, buttonTextColor: aparencia.buttonTextColor,
            cardColor: aparencia.cardColor, cardTextColor: aparencia.cardTextColor,
            radius: RAIO[aparencia.buttonStyle] ?? "rounded-xl", isOutline: aparencia.buttonStyle === "outline",
          }}
          aoAbrirProduto={() => {}} aoAbrirPost={() => {}} alturaCheia={false} />
        </EmPreviaContext.Provider>
      </div>
    </div>
  );
}
