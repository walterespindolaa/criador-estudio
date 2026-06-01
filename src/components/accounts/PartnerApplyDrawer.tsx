import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { usePartner } from "@/hooks/usePartner";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const CURRENT_CLIENTS_OPTIONS = ["Nenhum ainda", "1 a 3", "4 a 10", "Mais de 10"] as const;
const TIME_ACTIVE_OPTIONS = ["Menos de 1 ano", "1 a 2 anos", "3 a 5 anos", "Mais de 5 anos"] as const;

const schema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo"),
  instagram_handle: z.string().trim().max(60, "Máximo 60 caracteres").optional().default(""),
  current_clients: z.enum(CURRENT_CLIENTS_OPTIONS, { errorMap: () => ({ message: "Selecione uma opção" }) }),
  time_active: z.enum(TIME_ACTIVE_OPTIONS, { errorMap: () => ({ message: "Selecione uma opção" }) }),
  cpf: z.string().refine((v) => onlyDigits(v).length === 11, "CPF inválido (11 dígitos)"),
  phone: z.string().refine((v) => {
    const d = onlyDigits(v);
    return d.length >= 12 && d.length <= 13 && d.startsWith("55");
  }, "Telefone deve incluir DDI 55 + DDD + número"),
  pix_key: z.string().trim().min(3, "Informe sua chave Pix"),
  accept: z.literal(true, { errorMap: () => ({ message: "Você precisa aceitar os termos" }) }),
});

type FormData = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PartnerApplyDrawer({ open, onOpenChange }: Props) {
  const { profile } = useProfile();
  const { requestPartner } = usePartner();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.name ?? "",
      instagram_handle: "",
      current_clients: undefined as unknown as typeof CURRENT_CLIENTS_OPTIONS[number],
      time_active: undefined as unknown as typeof TIME_ACTIVE_OPTIONS[number],
      cpf: "",
      phone: "55",
      pix_key: "",
      accept: false as unknown as true,
    },
  });

  useEffect(() => {
    if (open && profile?.name) setValue("full_name", profile.name);
  }, [open, profile?.name, setValue]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const accept = watch("accept");

  const onSubmit = handleSubmit(async (data) => {
    try {
      const handle = (data.instagram_handle ?? "").trim().replace(/^@/, "");
      await requestPartner.mutateAsync({
        full_name: data.full_name.trim(),
        instagram_handle: handle,
        current_clients: data.current_clients,
        time_active: data.time_active,
        cpf: onlyDigits(data.cpf),
        phone: onlyDigits(data.phone),
        pix_key: data.pix_key.trim(),
      });
      onOpenChange(false);
    } catch {
      // toast já é tratado no hook
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quero ser parceira
          </DialogTitle>
          <DialogDescription className="font-body text-sm">
            Preencha seus dados pra solicitar entrada no programa. Após análise, você recebe um cupom exclusivo pra usar com seus clientes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5 mt-4">
          {/* Sobre você */}
          <section className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Sobre você</h3>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nome completo</Label>
              <Input {...register("full_name")} className="rounded-xl" placeholder="Seu nome completo" />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Instagram</Label>
              <Input {...register("instagram_handle")} className="rounded-xl" placeholder="@seuusuario" />
              {errors.instagram_handle && <p className="text-xs text-destructive">{errors.instagram_handle.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Quantos clientes você atende hoje?</Label>
              <Controller
                control={control}
                name="current_clients"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENT_CLIENTS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.current_clients && <p className="text-xs text-destructive">{errors.current_clients.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Há quanto tempo você atua?</Label>
              <Controller
                control={control}
                name="time_active"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_ACTIVE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.time_active && <p className="text-xs text-destructive">{errors.time_active.message}</p>}
            </div>
          </section>

          {/* Dados de pagamento */}
          <section className="space-y-3 pt-2 border-t border-border">
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground pt-1">Dados de pagamento</h3>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">CPF</Label>
              <Input
                {...register("cpf")}
                className="rounded-xl"
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
              {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">WhatsApp (com DDI 55 + DDD)</Label>
              <Input
                {...register("phone")}
                className="rounded-xl"
                placeholder="5547999999999"
                inputMode="numeric"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Chave Pix</Label>
              <Input {...register("pix_key")} className="rounded-xl" placeholder="CPF, e-mail, celular ou chave aleatória" />
              {errors.pix_key && <p className="text-xs text-destructive">{errors.pix_key.message}</p>}
            </div>
          </section>

          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="accept-terms"
              checked={accept}
              onCheckedChange={(v) => setValue("accept", (v === true) as true, { shouldValidate: true })}
              className="mt-0.5"
            />
            <Label htmlFor="accept-terms" className="text-xs font-body text-muted-foreground leading-relaxed cursor-pointer">
              Li e aceito os <a href="/termos" target="_blank" rel="noreferrer" className="text-primary hover:underline">termos do programa de parceiras</a>.
            </Label>
          </div>
          {errors.accept && <p className="text-xs text-destructive">{errors.accept.message}</p>}

          <Button type="submit" disabled={isSubmitting || !accept} className="w-full mt-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar solicitação
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
