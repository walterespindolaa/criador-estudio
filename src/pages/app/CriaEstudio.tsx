import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Wand2, Loader2, Image as ImageIcon, Download, Trash2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useHiggsfieldJobs, useGenerateArt, usePollJob, useDeleteJob, type HfJob } from "@/hooks/useHiggsfield";

const ASPECTS = [
  { v: "4:5", label: "4:5 (feed)" },
  { v: "1:1", label: "1:1 (quadrado)" },
  { v: "9:16", label: "9:16 (story)" },
];

export default function CriaEstudio() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const [sp] = useSearchParams();

  const [title, setTitle] = useState(sp.get("ideia") ?? "");
  const [format, setFormat] = useState<"carrossel" | "estatico">("carrossel");
  const [slides, setSlides] = useState(6);
  const [aspect, setAspect] = useState("4:5");
  const [resolution, setResolution] = useState("1080p");

  const { data: jobs = [] } = useHiggsfieldJobs();
  const gen = useGenerateArt();
  const poll = usePollJob();
  const del = useDeleteJob();

  // Polling enquanto houver jobs em andamento.
  const runningIds = useMemo(() => jobs.filter((j) => j.status === "running").map((j) => j.id).join(","), [jobs]);
  useEffect(() => {
    if (!runningIds) return;
    const ids = runningIds.split(",");
    const t = setInterval(() => ids.forEach((id) => poll.mutate(id)), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIds]);

  if (!isAdmin) {
    return (
      <div className="py-20 text-center">
        <Lock className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-body text-muted-foreground">Cria Estúdio é um recurso interno (admin).</p>
      </div>
    );
  }

  const gerar = () => {
    if (!title.trim()) return;
    gen.mutate({ title: title.trim(), format, slides, aspect_ratio: aspect, resolution });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <Wand2 className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Cria Estúdio</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Gera carrosséis e estáticos no Higgsfield, no seu estilo. (interno)</p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div>
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ideia / tema</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: 5 erros que travam quem tá começando com IA" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Formato</p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["carrossel", "estatico"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={cn("px-3 h-9 text-sm font-body", format === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{f === "carrossel" ? "Carrossel" : "Estático"}</button>
              ))}
            </div>
          </div>
          {format === "carrossel" && (
            <div>
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Páginas</p>
              <Input type="number" min={2} max={10} value={slides} onChange={(e) => setSlides(Math.max(2, Math.min(10, Number(e.target.value) || 6)))} className="h-9 w-20" />
            </div>
          )}
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Proporção</p>
            <div className="flex gap-1">
              {ASPECTS.map((a) => (
                <button key={a.v} onClick={() => setAspect(a.v)} className={cn("px-2.5 h-9 rounded-lg text-xs font-body border", aspect === a.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{a.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Resolução</p>
            <div className="flex gap-1">
              {["720p", "1080p"].map((r) => (
                <button key={r} onClick={() => setResolution(r)} className={cn("px-2.5 h-9 rounded-lg text-xs font-body border", resolution === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{r}</button>
              ))}
            </div>
          </div>
          <Button onClick={gerar} disabled={gen.isPending || !title.trim()} className="h-9 ml-auto">
            {gen.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Gerar
          </Button>
        </div>
        <p className="text-[11px] font-body text-muted-foreground">A IA escreve os prompts com a sua marca (paleta/estilo do Brandbook) e dispara no Higgsfield. A capa é otimizada pra ser chamativa; as demais páginas seguem o mesmo padrão visual.</p>
      </div>

      {/* Jobs */}
      <div className="mt-6 space-y-5">
        {jobs.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-14 text-center">
            <ImageIcon className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nada gerado ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1">Digite uma ideia acima e clique em Gerar.</p>
          </div>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} onDelete={() => del.mutate(job.id)} />)
        )}
      </div>
    </motion.div>
  );
}

function JobCard({ job, onDelete }: { job: HfJob; onDelete: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-display font-bold text-foreground truncate">{job.title}</p>
        <span className={cn("text-[10px] font-body px-1.5 py-0.5 rounded-full",
          job.status === "done" ? "bg-secondary/15 text-secondary" : job.status === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          {job.status === "running" ? "gerando…" : job.status === "done" ? "pronto" : job.status === "partial" ? "parcial" : "erro"}
        </span>
        <span className="text-[11px] font-body text-muted-foreground">{job.format} · {job.aspect_ratio}</span>
        <button onClick={onDelete} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
      </div>
      {job.error && <p className="text-xs font-body text-destructive mb-2">{job.error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {job.pages.map((pg, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden bg-muted/30">
            <div className="aspect-[4/5] relative flex items-center justify-center">
              {pg.image_url ? (
                <img src={pg.image_url} alt={pg.role} className="absolute inset-0 w-full h-full object-cover" />
              ) : (pg.status || "").startsWith("err") || pg.status === "failed" || pg.status === "nsfw" ? (
                <span className="text-[11px] font-body text-destructive px-2 text-center">falhou ({pg.status})</span>
              ) : (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
            </div>
            <div className="p-2">
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase">{i === 0 ? "capa" : pg.role}</p>
              {pg.screen_text && <p className="text-[11px] font-body text-foreground line-clamp-2 mt-0.5">{pg.screen_text}</p>}
              {pg.image_url && (
                <a href={pg.image_url} target="_blank" rel="noreferrer" download className="text-[11px] font-body text-primary flex items-center gap-1 mt-1 hover:underline">
                  <Download className="h-3 w-3" /> baixar
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
