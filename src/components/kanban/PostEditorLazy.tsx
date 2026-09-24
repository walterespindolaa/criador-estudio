import { lazy, Suspense, useState, type ComponentProps } from "react";

/* O editor de post (3 mil linhas: mídia, IA, prévia, parceiro, reciclagem)
   só baixa quando abre. Ideias, Criando e Plano montavam ele fechado, então
   o chunk vinha inteiro no primeiro clique do menu (pente fino 24/09/2026).
   A pessoa abre o editor uma vez por sessão e ele fica em cache do SW.

   DEPOIS DA PRIMEIRA ABERTURA ELE FICA MONTADO (24/09/2026). A primeira
   versão desmontava ao fechar, e o editor precisa continuar vivo quando a
   pessoa fecha com vídeo ainda subindo ("Fechar mesmo assim"): é ele que
   grava o registro do vídeo no fim do upload. Desmontar perdia esse vídeo.
   Também devolve a animação de saída do diálogo. */
const Real = lazy(() => import("./PostEditor").then((m) => ({ default: m.PostEditor })));

type Props = ComponentProps<typeof Real>;

export function PostEditorLazy(props: Props) {
  const [jaAbriu, setJaAbriu] = useState(false);
  if (props.open && !jaAbriu) setJaAbriu(true);
  if (!props.open && !jaAbriu) return null;
  return (
    <Suspense fallback={null}>
      <Real {...props} />
    </Suspense>
  );
}
