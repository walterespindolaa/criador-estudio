import { ModuleGate } from "@/components/accounts/ModuleGate";
import { CriaPostBoard } from "@/components/accounts/CriaPostBoard";
import { ManagerCalendar } from "@/components/accounts/ManagerCalendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CriaPost() {
  return (
    <ModuleGate code="aprovapost_externo">
      <Tabs defaultValue="clientes" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5">
          <TabsTrigger value="clientes" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Clientes</TabsTrigger>
          <TabsTrigger value="calendario" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Calendário geral</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes"><CriaPostBoard /></TabsContent>
        <TabsContent value="calendario"><ManagerCalendar /></TabsContent>
      </Tabs>
    </ModuleGate>
  );
}
