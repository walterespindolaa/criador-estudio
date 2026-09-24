import { lazy, Suspense, type ComponentProps } from "react";

/* O editor de post (3 mil linhas: mídia, IA, prévia, parceiro, reciclagem)
   só baixa quando abre. Ideias, Criando e Plano montavam ele fechado, então
   o chunk vinha inteiro no primeiro clique do menu (pente fino 24/09/2026).
   A pessoa abre o editor uma vez por sessão e ele fica em cache do SW. */
const Real = lazy(() => import("./PostEditor").then((m) => ({ default: m.PostEditor })));

type Props = ComponentProps<typeof Real>;

export function PostEditorLazy(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Real {...props} />
    </Suspense>
  );
}
