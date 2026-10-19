import { useNavigate, useOutletContext } from "react-router-dom";
import { useModules } from "@/hooks/useModules";
import type { ManagerOutletContext } from "@/components/accounts/managerOutlet";

/**
 * Abre a vitrine de um módulo (o mesmo popup com preço do menu da gestão).
 * Usado pelos selos "Cria Gestão" / "Cria Post" nos passos e atalhos travados.
 * Fora da casca da gestão (sem o contexto do outlet), leva pra home da gestão,
 * onde os módulos aparecem.
 */
export function useAbrirModulo() {
  const { modules } = useModules();
  const navigate = useNavigate();
  const ctx = useOutletContext<ManagerOutletContext | undefined>();
  return (codigo: string) => {
    const m = modules.find((x) => x.code === codigo);
    if (m && ctx?.openModule) { ctx.openModule(m); return; }
    navigate("/socialmidia/dashboard");
  };
}
