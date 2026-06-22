import { ModuleGate } from "@/components/accounts/ModuleGate";
import { CriaPostBoard } from "@/components/accounts/CriaPostBoard";
import { CronogramaBoard } from "@/components/accounts/CronogramaBoard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CriaPost() {
  return (
    <ModuleGate code="aprovapost_externo">
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5">
          <TabsTrigger value="posts" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Posts</TabsTrigger>
          <TabsTrigger value="cronograma" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Cronograma</TabsTrigger>
        </TabsList>
        <TabsContent value="posts"><CriaPostBoard /></TabsContent>
        <TabsContent value="cronograma">
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight mb-4">Cria Cronograma</h1>
          <CronogramaBoard />
        </TabsContent>
      </Tabs>
    </ModuleGate>
  );
}
