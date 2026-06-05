import { ModuleGate } from "@/components/accounts/ModuleGate";
import { CriaPostBoard } from "@/components/accounts/CriaPostBoard";

export default function CriaPost() {
  return <ModuleGate code="aprovapost_externo"><CriaPostBoard /></ModuleGate>;
}
