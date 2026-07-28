import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      // TECLADO NÃO ABRE SOZINHO.
      // O Radix foca o primeiro elemento focável ao abrir. No celular, se esse
      // elemento for um input, o teclado sobe sozinho, cobre metade da tela e a
      // pessoa nem sabe onde está digitando. Aqui o foco vai pro CONTAINER:
      // acessibilidade preservada (leitor de tela anuncia o dialog), teclado só
      // aparece se ela TOCAR num campo. Um dialog pode sobrescrever se precisar.
      onOpenAutoFocus={(e) => {
        if (onOpenAutoFocus) return onOpenAutoFocus(e);
        e.preventDefault();
        (e.currentTarget as HTMLElement)?.focus?.();
      }}
      className={cn(
        // PADRÃO DOS MODAIS DO CRIA
        // O shadcn vem com rounded-lg (8px), max-w-lg (512px) e p-6. Resultado: uma
        // colunazinha estreita, quadrada, com scroll interno, no meio de uma tela vazia.
        // Aqui: canto 3xl (igual aos cards), largura de trabalho (2xl), respiro (p-7)
        // e altura limitada com scroll só quando precisa.
        // MOBILE: ancora no topo respeitando a SAFE-AREA do notch/Dynamic Island (o topo
        // fica sempre ABAIXO do relógio/status bar), sem translate vertical, e usa dvh
        // descontando as safe-areas, pra que título + botão X fiquem sempre visíveis e o
        // rodapé com "Salvar" não fique atrás do teclado do iOS quando um campo perto do
        // fim ganha foco. DESKTOP (sm:): volta ao centralizado original, sem mudança.
        "fixed left-[50%] top-[calc(env(safe-area-inset-top)+0.5rem)] sm:top-[50%] z-50 flex flex-col w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] sm:max-h-[88vh] overflow-y-auto",
        "translate-x-[-50%] translate-y-0 sm:translate-y-[-50%] gap-5 border bg-background p-6 sm:p-7 shadow-2xl rounded-3xl duration-200",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      {/* Fechar: era um X de 16px quase invisível. Agora é um alvo de verdade. */}
      <DialogPrimitive.Close className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-muted-foreground opacity-80 transition-colors hover:bg-muted hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
