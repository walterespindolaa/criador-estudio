import { lazy, Suspense, type ComponentProps } from "react";

/* O relatório do cliente (2.800 linhas, recharts, jsPDF) só carrega quando
   alguém abre o diálogo. Antes vinha junto com o quadro do Cria Post e com o
   card de relatório rápido em toda abertura de ficha (pente fino 24/09/2026). */
const Real = lazy(() => import("./ClientReportDialog").then((m) => ({ default: m.ClientReportDialog })));

type Props = ComponentProps<typeof Real>;

export function ClientReportDialogLazy(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Real {...props} />
    </Suspense>
  );
}
