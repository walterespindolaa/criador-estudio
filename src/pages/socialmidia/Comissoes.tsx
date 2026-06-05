import { Navigate } from "react-router-dom";
import { usePartner } from "@/hooks/usePartner";
import { PartnerCommissions } from "@/components/accounts/PartnerCommissions";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";

export default function Comissoes() {
  const { isPartner, isLoading } = usePartner();
  if (!isLoading && !isPartner) return <Navigate to="/socialmidia/parceria" replace />;
  return (
    <div>
      <ManagerSectionTitle t="Suas comissões" s="A comissão libera após o cliente pagar a 2ª fatura." />
      <PartnerCommissions />
    </div>
  );
}
