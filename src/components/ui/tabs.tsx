import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/* ═══════════════════════════════════════════════════════════════════════════
   ABAS EM PÍLULA — o padrão do CRIA

   O padrão que veio do shadcn é um retângulo cinza com cantos de 2px. Ele é
   correto e é sem alma: parece painel de configuração, não parece o Cria.

   E tinha um problema de USO, não só de gosto: em várias telas a aba ativa se
   distinguia por uma sublinha de 2px. No celular isso é praticamente invisível,
   e o alvo do dedo ficava pequeno. A pílula resolve as duas coisas — a ativa
   vira um objeto sólido (branco, sombra, laranja) dentro de um trilho, e a
   área de toque cresce.

   Mudar AQUI muda o sistema inteiro. As telas que passam className continuam
   podendo sobrescrever; o que elas não passarem herda isto.
   ═══════════════════════════════════════════════════════════════════════════ */

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto items-center justify-center gap-1 rounded-full border border-border bg-muted/50 p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5",
      "font-body text-[13px] font-semibold ring-offset-background transition-colors",
      "hover:text-foreground",
      "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
