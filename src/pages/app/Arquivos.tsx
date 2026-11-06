import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Upload, Search, Trash2, FileText, ImageIcon, Crown, Plus, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, File as FileIcon, Link2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DrivePickerButton } from "@/components/drive/DrivePickerButton";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import { DriveMediaPreview } from "@/components/drive/DriveMediaPreview";
import { useFiles } from "@/hooks/useFiles";
import { useDriveFolder, type DriveItem } from "@/hooks/useDriveFolder";
import { useUserLinks, type UserLink } from "@/hooks/useUserLinks";
import { cn } from "@/lib/utils";
import { storageBytesForPlan, formatStorage, STORAGE_BYTES, TIER_LABEL, tierRank, type PlanId } from "@/lib/plans";
import { useTier } from "@/hooks/useTier";
import type { Database } from "@/integrations/supabase/types";
import { confirmar } from "@/components/shared/Confirm";

type DriveRef = Database["public"]["Tables"]["external_media_refs"]["Row"];

const CATEGORIES = ["geral", "referência", "marca", "inspiração", "roteiro"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_RETENTION_DAYS = 30;
const MAX_IMAGE_DIM = 1920;
const JPEG_QUALITY = 0.8;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
      const scale = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

function SignedImage({
  path,
  alt,
  resolve,
}: {
  path: string;
  alt: string;
  resolve: (p: string) => Promise<string>;
}) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    resolve(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path, resolve]);
  if (!url) return <ImageIcon className="h-8 w-8 text-muted-foreground" />;
  return <img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />;
}

// ── LINKS ÚTEIS / DRIVE DO USUÁRIO FINAL ──
// Mesma ideia da aba "Links úteis" do gestor (ClienteHub): o criador salva os
// próprios links (rótulo + URL) e, pros que forem do Drive, a gente lista as
// pastas/arquivos daquela pasta. A diferença é o armazenamento: aqui os links
// são da CONTA do criador (profiles.useful_links), não de um cliente.

// Detecta se um link é de Drive (pelo rótulo ou pela URL).
function isDriveLink(l: UserLink) {
  return /drive/i.test(l.label) || /drive\.google|docs\.google/i.test(l.url);
}

function fmtDriveDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const DRIVE_PAGE_SIZE = 10;

// Editor de links (rótulo + URL): adicionar / listar / remover. Grava o array
// inteiro no jsonb do perfil, igual o gestor faz com useful_links.
function UserLinksEditor({
  rows,
  onSave,
}: {
  rows: UserLink[];
  onSave: (next: UserLink[]) => void;
}) {
  const [draft, setDraft] = useState<UserLink[]>(rows);
  const [novoLabel, setNovoLabel] = useState("");
  const [novoUrl, setNovoUrl] = useState("");

  // Adota o servidor quando os links mudam de fora (só salvamos no blur).
  useEffect(() => { setDraft(rows); }, [rows]);

  const adicionar = () => {
    const url = novoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { toast.error("A URL precisa começar com http:// ou https://"); return; }
    onSave([...draft, { label: novoLabel.trim() || "Link", url }]);
    setNovoLabel(""); setNovoUrl("");
  };

  const remover = (i: number) => onSave(draft.filter((_, idx) => idx !== i));
  const editar = (i: number, campo: keyof UserLink, valor: string) =>
    setDraft((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));

  const salvarEdicao = () => {
    const bad = draft.find((r) => r.url && !/^https?:\/\//i.test(r.url));
    if (bad) { toast.error("A URL precisa começar com http:// ou https://"); return; }
    onSave(draft);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-body text-muted-foreground">Seus links (Drive, pastas, materiais…)</p>
      </div>

      {draft.length > 0 && (
        <div className="space-y-2 mb-3">
          {draft.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={r.label} onChange={(e) => editar(i, "label", e.target.value)} onBlur={salvarEdicao}
                placeholder="Rótulo (ex.: Drive - Fotos)" className="rounded-xl h-9 text-sm w-24 sm:w-40 shrink-0" />
              <Input value={r.url} onChange={(e) => editar(i, "url", e.target.value)} onBlur={salvarEdicao}
                placeholder="https://…" className="rounded-xl h-9 text-sm flex-1 min-w-0" />
              <a href={r.url} target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link" className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-primary shrink-0"><ExternalLink className="h-4 w-4" /></a>
              <button onClick={() => remover(i)} title="Remover" aria-label="Remover" className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Input value={novoLabel} onChange={(e) => setNovoLabel(e.target.value)} placeholder="Rótulo (ex.: Drive - Aprovados)" className="rounded-xl h-9 text-sm w-32 sm:w-40" />
        <Input value={novoUrl} onChange={(e) => setNovoUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="https://drive.google.com/…" className="rounded-xl h-9 text-sm flex-1 min-w-[160px]" />
        <Button onClick={adicionar} disabled={!novoUrl.trim()} className="rounded-xl h-9 gap-1.5"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
    </div>
  );
}

// Lista o conteúdo das pastas do Drive salvas nos links do usuário. Reaproveita
// useDriveFolder (edge drive-list), com paginação de 10 por página, pastas
// primeiro (a API já ordena), nome clicável abre no Drive em nova aba.
function UserDriveFolders({ links }: { links: UserLink[] }) {
  const drives = useMemo(() => (links ?? []).filter((l) => l?.url && isDriveLink(l)), [links]);
  const [sel, setSel] = useState(0);
  const [page, setPage] = useState(0);
  const activeDrive = drives[Math.min(sel, drives.length - 1)] ?? null;
  const { data, isLoading, isError, error, isFetching, refetch } = useDriveFolder(activeDrive?.url);

  // Trocar de pasta volta pra primeira página (a paginação é por pasta).
  useEffect(() => { setPage(0); }, [sel]);

  // Sem link de Drive salvo: estado vazio com instrução.
  if (drives.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/60 mb-3" />
        <p className="text-sm font-body text-foreground font-medium">Nenhuma pasta do Drive nos seus links</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-md mx-auto">
          Cole um link da pasta do Google Drive no editor acima, com "Drive" no rótulo.
          A pasta precisa estar compartilhada como <strong>"qualquer pessoa com o link pode ver"</strong>.
        </p>
      </div>
    );
  }

  const items: DriveItem[] = data?.items ?? [];
  const rootUrl = data?.root_url ?? activeDrive?.url ?? "";
  const totalPages = Math.max(1, Math.ceil(items.length / DRIVE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * DRIVE_PAGE_SIZE, safePage * DRIVE_PAGE_SIZE + DRIVE_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Barra: seletor (se houver mais de uma pasta), atualizar, abrir no Drive. */}
      <div className="flex flex-wrap items-center gap-2">
        {drives.length > 1 && (
          <select
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            aria-label="Escolher pasta do Drive"
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-body font-semibold cursor-pointer outline-none max-w-[60%]"
          >
            {drives.map((d, i) => <option key={i} value={i}>{d.label || d.url}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
        {rootUrl && (
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => window.open(rootUrl, "_blank", "noopener,noreferrer")}>
            <FolderOpen className="h-4 w-4" /> Abrir no Drive
          </Button>
        )}
      </div>

      {/* Loading: skeleton de linhas. */}
      {isLoading && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
              <div className="h-4 rounded bg-muted animate-pulse flex-1 max-w-[40%]" />
              <div className="h-3 w-20 rounded bg-muted animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Erro: mensagem amigável (pasta privada, chave ausente, etc.). */}
      {!isLoading && isError && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-6 text-center">
          <p className="text-sm font-body text-amber-800 dark:text-amber-300 font-medium">
            {(error as Error)?.message || "Não foi possível listar a pasta do Drive."}
          </p>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 mt-3" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </Button>
        </div>
      )}

      {/* Vazia. */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-muted-foreground">Esta pasta está vazia.</p>
        </div>
      )}

      {/* Listagem: pastas primeiro, nome clicável abre no Drive. Máx 10 por página. */}
      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {pageItems.map((it) => (
              <a
                key={it.id}
                href={it.webViewLink ?? rootUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
              >
                {it.isFolder
                  ? <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  : <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />}
                <span className="text-[13px] font-body text-foreground truncate flex-1 min-w-0">{it.name}</span>
                {it.modifiedTime && (
                  <span className="text-[11px] font-body text-muted-foreground shrink-0 hidden sm:inline">{fmtDriveDate(it.modifiedTime)}</span>
                )}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>

          {/* Paginação: só quando passa de 10 itens. Botões recuar/avançar (‹ ›). */}
          {items.length > DRIVE_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0" aria-label="Página anterior"
                onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[12px] font-body text-muted-foreground tabular-nums">
                Página {safePage + 1} de {totalPages}
              </span>
              <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0" aria-label="Próxima página"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* LINKS ÚTEIS E PASTAS DO DRIVE (Walter, 06/11/2026, mockup aprovado): saem da
   primeira tela e viram duas pastas recolhidas embaixo da gaveta, com o número
   de itens na etiqueta. Abrir mostra o editor e a listagem de sempre. */
function PastaRecolhivel({ titulo, resumo, cor, aberta, onToggle, children }: {
  titulo: string; resumo: string; cor: string; aberta: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="relative pt-3 min-w-0">
      <span aria-hidden className="absolute left-4 top-0 h-4 w-24 rounded-t-lg border-2 border-b-0 border-foreground" style={{ background: cor }} />
      <div className="relative rounded-xl border-2 border-foreground shadow-[4px_4px_0_hsl(var(--foreground))] overflow-hidden" style={{ background: cor }}>
        <button type="button" onClick={onToggle} aria-expanded={aberta}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-[#1d1b18]">
          <span className="min-w-0 flex-1">
            <span className="block font-display font-extrabold text-[15px] leading-tight">{titulo}</span>
            <span className="block text-[11.5px] font-body text-[#1d1b18]/70">{resumo}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", aberta && "rotate-180")} />
        </button>
        {aberta && <div className="bg-card border-t-2 border-foreground p-3 sm:p-4 text-foreground">{children}</div>}
      </div>
    </div>
  );
}

function UserLinksSection() {
  const { links, save } = useUserLinks();
  const [abertaLinks, setAbertaLinks] = useState(false);
  const [abertaDrive, setAbertaDrive] = useState(false);
  const drives = (links ?? []).filter((l) => l?.url && isDriveLink(l));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <PastaRecolhivel titulo="Links úteis" cor="#F6DFA0" aberta={abertaLinks} onToggle={() => setAbertaLinks((v) => !v)}
        resumo={links.length ? `${links.length} ${links.length === 1 ? "link" : "links"} · toque pra abrir` : "nenhum ainda · toque pra adicionar"}>
        <UserLinksEditor rows={links} onSave={(next) => save.mutate(next)} />
      </PastaRecolhivel>
      <PastaRecolhivel titulo="Pastas do Google Drive" cor="#D7E3FF" aberta={abertaDrive} onToggle={() => setAbertaDrive((v) => !v)}
        resumo={drives.length ? `${drives.length} ${drives.length === 1 ? "pasta" : "pastas"} · toque pra abrir` : "nenhuma ainda · cole o link de uma pasta em Links úteis"}>
        <UserDriveFolders links={links} />
      </PastaRecolhivel>
    </div>
  );
}

type Aba = "tudo" | "imagem" | "video" | "pdf" | "vencendo";
const PASSO = 20;
type Ficha = {
  chave: string;
  nome: string;
  tipo: "imagem" | "video" | "pdf" | "outro";
  origem: "upload" | "posts";
  categoria: string | null;
  dias: number | null;
  postTitulo: string | null;
  upload: ReturnType<typeof useFiles>["files"][number] | null;
  ref: DriveRef | null;
  criado: string;
};
const ROTULO_TIPO: Record<Ficha["tipo"], string> = { imagem: "IMAGEM", video: "VÍDEO", pdf: "PDF", outro: "ARQUIVO" };

/* A FICHA da gaveta: prévia grande, tipo na etiqueta, carimbo "some em N dias"
   nos temporários e, embaixo, de onde veio (o post onde foi usada ou o upload). */
function FichaArquivo({ f, resolver, onAbrir, onApagar }: {
  f: Ficha; resolver: (p: string) => Promise<string>; onAbrir: () => void; onApagar: () => void;
}) {
  const [falhou, setFalhou] = useState(false);
  const thumb = f.ref?.thumbnail_url && !falhou ? f.ref.thumbnail_url : null;
  return (
    <div className="group relative min-w-0 rounded-xl border-2 border-foreground bg-[#FFFCF3] dark:bg-background shadow-[4px_4px_0_hsl(var(--foreground))] overflow-hidden">
      <button type="button" onClick={onAbrir} className="block w-full text-left">
        <div className="relative aspect-[4/5] border-b-2 border-foreground bg-muted grid place-items-center overflow-hidden">
          {f.upload && f.tipo === "imagem" ? (
            <SignedImage path={f.upload.storage_path} alt={f.nome} resolve={resolver} />
          ) : thumb ? (
            <img src={thumb} alt={f.nome} loading="lazy" onError={() => setFalhou(true)} className="w-full h-full object-cover" />
          ) : f.tipo === "pdf" ? (
            <div className="w-full h-full bg-white" style={{ backgroundImage: "repeating-linear-gradient(transparent 0 15px, #E9E2D0 15px 16px)" }} />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground" />
          )}
          {f.tipo === "video" && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-foreground bg-white"><Play className="h-4 w-4 ml-0.5 text-[#1d1b18]" fill="currentColor" /></span>
            </span>
          )}
          <span className="absolute left-2 top-2 rounded-full border-[1.5px] border-foreground bg-white px-2 py-px text-[9.5px] font-body font-extrabold tracking-wide text-[#1d1b18]">{ROTULO_TIPO[f.tipo]}</span>
          {f.dias !== null && f.dias <= 7 && (
            <span className="absolute right-2 bottom-2 -rotate-6 rounded border-2 border-[#D93A12] bg-white/90 px-1.5 py-px text-[10px] font-body font-extrabold uppercase text-[#D93A12]">
              {f.dias <= 0 ? "some hoje" : `some em ${f.dias} ${f.dias === 1 ? "dia" : "dias"}`}
            </span>
          )}
        </div>
        <div className="px-2.5 py-2">
          <p className="text-[12.5px] font-body font-bold text-foreground truncate">{f.nome}</p>
          <p className="text-[11.5px] font-body italic text-muted-foreground truncate">
            {f.origem === "posts"
              ? (f.postTitulo ? <>no post <span className="text-[#0061EE] not-italic font-semibold">{f.postTitulo}</span></> : "mídia vinculada")
              : <>upload · {(f.categoria ?? "geral")}{f.dias === null ? " · permanente" : ""}</>}
          </p>
        </div>
      </button>
      <button type="button" onClick={onApagar} aria-label="Excluir"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-foreground bg-white text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const Arquivos = () => {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const ownerId = activeAccountId || user?.id || "";
  const queryClient = useQueryClient();
  // Barra de cota reflete a CONTA ATIVA (o dono dos arquivos).
  // NÃO usar pra gate de billing, só exibição.
  const { profile: activeProfile } = useActiveProfile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files, uploadFile, deleteFile, getPublicUrl } = useFiles();
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ kind: "image" | "pdf" | "iframe" | "none"; url: string | null; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState("geral");
  const [pendingPermanent, setPendingPermanent] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  // A GAVETA: aba por tipo, pílula por origem, "Ver mais" de 20 em 20.
  const [aba, setAba] = useState<Aba>("tudo");
  const [origem, setOrigem] = useState<string>("todas");
  const [quantos, setQuantos] = useState(PASSO);

  const storageUsed = activeProfile?.storage_used_bytes ?? 0;
  const storageQuota = activeProfile?.storage_quota_bytes ?? storageBytesForPlan(null, false);

  // Qual é o PRÓXIMO plano que dá mais espaço e quanto ele dá de verdade.
  // (Se já está no topo, não existe convite: mostrar "faça upgrade" pra quem
  // está no Studio é insultar quem já te paga o máximo.)
  const { tier } = useTier();
  const upgradeStorage = (() => {
    const escada: PlanId[] = ["essencial", "pro", "studio"];
    const proximo = escada.find(
      (p) => tierRank(p) > tierRank(tier) && STORAGE_BYTES[p] > storageQuota,
    );
    if (!proximo) return null;
    return { plano: proximo, nome: TIER_LABEL[proximo], espaco: formatStorage(STORAGE_BYTES[proximo]) };
  })();
  const retentionDays = activeProfile?.storage_retention_days ?? DEFAULT_RETENTION_DAYS;
  const usagePct = Math.min(100, storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0);
  const isStorageFull = storageUsed >= storageQuota;
  const uploading = uploadFile.isPending;

  const { data: driveFiles, refetch: refetchDrive } = useQuery<DriveRef[]>({
    queryKey: ["drive-files", ownerId],
    queryFn: async () => {
      if (!ownerId) return [];
      const { data, error } = await supabase
        .from("external_media_refs")
        .select("*")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DriveRef[];
    },
    enabled: !!ownerId,
  });

  const handleFileSelect = async (rawFile: File) => {
    if (rawFile.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Limite: 50MB por arquivo.");
      return;
    }
    const file = await compressImage(rawFile);
    const projected = storageUsed + file.size;
    if (projected > storageQuota) {
      toast.error("Armazenamento cheio. Exclua arquivos ou aguarde a limpeza automática.");
      return;
    }
    setPendingFile(file);
    setPendingCategory("geral");
    setPendingPermanent(false);
    setCategoryDialogOpen(true);
  };

  const handleUpload = async (file: File, category: string, permanent: boolean) => {
    const expiresAt = permanent
      ? null
      : new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      await uploadFile.mutateAsync({
        file,
        category,
        source: "upload",
        expiresAt,
      });
      toast.success("Arquivo enviado!");
    } catch (e) {
      console.error("[arquivos] upload failed", {
        name: file.name,
        size: file.size,
        type: file.type,
        category,
        error: e,
      });
      toast.error("Erro no upload.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDelete = async (f: { id: string; storage_path: string; size_bytes?: number | null }) => {
    // Apaga do storage de vez: sem lixeira. Por isso pergunta (pente fino 23/09).
    if (!(await confirmar({ titulo: "Excluir este arquivo?", descricao: "Ele sai do seu armazenamento e não dá pra recuperar.", acao: "Excluir", destrutivo: true }))) return;
    try {
      await deleteFile.mutateAsync(f);
      toast.success("Arquivo removido.");
    } catch {
      toast.error("Erro ao remover arquivo.");
    }
  };

  const deleteDriveRef = async (ref: DriveRef) => {
    try {
      // 1) Bunny: deletar no Bunny PRIMEIRO (a edge confere a ref antes de remover).
      // A edge trata 404 como sucesso (idempotência); só retorna erro em falha real.
      // Se o invoke falhar, ABORTA: NÃO apagamos a ref (senão o vídeo pago fica órfão
      // no Bunny sem ninguém pra rastreá-lo). O usuário tenta de novo.
      if (ref.provider === "bunny" && ref.external_file_id) {
        let bunnyFailed = false;
        try {
          const { error } = await supabase.functions.invoke("bunny-delete-video", {
            body: { videoGuid: ref.external_file_id, accountId: ownerId },
          });
          if (error) { console.error("[bunny-delete-video] invoke error", error); bunnyFailed = true; }
        } catch (e) {
          console.error("[bunny-delete-video] invoke threw", e);
          bunnyFailed = true;
        }
        if (bunnyFailed) {
          toast.error("Não foi possível remover o vídeo agora, tente de novo.");
          return;
        }
      }
      // 2) Storage: remover do bucket "media" (external_file_id guarda o path).
      if (ref.provider === "storage" && ref.external_file_id) {
        const { error: storErr } = await supabase.storage.from("media").remove([ref.external_file_id]);
        if (storErr) console.error("[arquivos] storage remove failed", storErr);
      }
      // 3) Decrementar cota se bunny ou storage. Drive nunca conta.
      const countsTowardQuota = ref.provider === "bunny" || ref.provider === "storage";
      const size = ref.file_size ?? 0;
      if (countsTowardQuota && size > 0 && ownerId) {
        const { error: decErr } = await (supabase.rpc as unknown as (
          fn: string, args: unknown,
        ) => Promise<{ error: unknown }>)("increment_storage", { _user: ownerId, _delta: -size });
        if (decErr) console.error("[arquivos] increment_storage failed (-)", decErr);
      }
      // 4) Apagar a row.
      const { error } = await supabase.from("external_media_refs").delete().eq("id", ref.id);
      if (error) { toast.error("Erro ao remover referência."); return; }
      refetchDrive();
      if (countsTowardQuota) {
        queryClient.invalidateQueries({ queryKey: ["active-profile"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
      toast.success("Referência removida.");
    } catch (e) {
      console.error("[arquivos] deleteDriveRef failed", e);
      toast.error("Erro ao remover.");
    }
  };

  const isImage = (type: string | null) => type?.startsWith("image/");

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };


  const daysUntilExpiry = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return null;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const uploads = files.filter((f) => (f.source ?? "upload") === "upload");

  // Título do post de cada mídia (external_media_refs.post_id já existe; a tela
  // só não mostrava onde o arquivo foi usado).
  const postIds = useMemo(
    () => Array.from(new Set((driveFiles ?? []).map((f) => f.post_id).filter((x): x is string => !!x))).slice(0, 500),
    [driveFiles],
  );
  const { data: titulosPost = {} } = useQuery<Record<string, string>>({
    queryKey: ["arquivos-titulos-post", ownerId, postIds.join(",")],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("id,title").in("id", postIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of (data ?? []) as { id: string; title: string | null }[]) m[r.id] = r.title || "post sem título";
      return m;
    },
  });

  const itens: Ficha[] = useMemo(() => {
    const ups: Ficha[] = uploads.map((f) => {
      const ehPdf = (f.file_type ?? "").includes("pdf") || /\.pdf$/i.test(f.name ?? "");
      return {
        chave: "u" + f.id, nome: f.name, tipo: isImage(f.file_type) ? "imagem" : ehPdf ? "pdf" : (f.file_type ?? "").startsWith("video/") ? "video" : "outro",
        origem: "upload", categoria: f.category ?? "geral", dias: daysUntilExpiry(f.expires_at), postTitulo: null,
        upload: f, ref: null, criado: f.created_at ?? "",
      };
    });
    const mids: Ficha[] = (driveFiles ?? []).map((f) => {
      const t = f.file_type ?? "";
      return {
        chave: "m" + f.id, nome: f.file_name, tipo: t.startsWith("image/") ? "imagem" : t.startsWith("video/") ? "video" : t.includes("pdf") ? "pdf" : "outro",
        origem: "posts", categoria: null, dias: null, postTitulo: f.post_id ? titulosPost[f.post_id] ?? null : null,
        upload: null, ref: f, criado: f.created_at ?? "",
      };
    });
    return [...ups, ...mids].sort((a, b) => (b.criado > a.criado ? 1 : b.criado < a.criado ? -1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads, driveFiles, titulosPost]);

  const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const porBusca = itens.filter((f) => {
    if (!search.trim()) return true;
    const q = semAcento(search.trim());
    return semAcento(f.nome ?? "").includes(q) || semAcento(f.postTitulo ?? "").includes(q);
  });
  const porOrigem = porBusca.filter((f) =>
    origem === "todas" ? true : origem === "posts" ? f.origem === "posts" : origem === "uploads" ? f.origem === "upload" : f.origem === "upload" && f.categoria === origem);
  const naAba = (f: Ficha, a: Aba) =>
    a === "tudo" ? true : a === "vencendo" ? f.dias !== null && f.dias <= 7 : f.tipo === a;
  const contagem = (a: Aba) => porOrigem.filter((f) => naAba(f, a)).length;
  const visiveis = porOrigem.filter((f) => naAba(f, aba));
  const mostradas = visiveis.slice(0, quantos);
  useEffect(() => { setQuantos(PASSO); }, [search, aba, origem]);

  const abrirFicha = async (f: Ficha) => {
    if (f.ref) { setPreview({ kind: "iframe", url: f.ref.view_url, name: f.ref.file_name }); return; }
    if (!f.upload) return;
    const url = await getPublicUrl(f.upload.storage_path);
    if (!url) { toast.error("Não foi possível abrir o arquivo."); return; }
    setPreview({ kind: f.tipo === "imagem" ? "image" : f.tipo === "pdf" ? "pdf" : "none", url, name: f.nome });
  };
  const apagarFicha = (f: Ficha) => {
    if (f.upload) return handleDelete(f.upload);
    if (f.ref) return (async () => {
      if (!(await confirmar({ titulo: "Remover esta mídia?", descricao: "Ela sai dos seus arquivos e do post onde foi usada.", acao: "Remover", destrutivo: true }))) return;
      await deleteDriveRef(f.ref!);
    })();
  };

  const ABAS: { k: Aba; rotulo: string; cor: string }[] = [
    { k: "tudo", rotulo: "Tudo", cor: "#FFFFFF" },
    { k: "imagem", rotulo: "Imagens", cor: "#D7E3FF" },
    { k: "video", rotulo: "Vídeos", cor: "#FFD3E8" },
    { k: "pdf", rotulo: "PDF", cor: "#FFE58A" },
    { k: "vencendo", rotulo: "Vencendo", cor: "#FFD6C7" },
  ];

  return (
    /* ARRASTAR NA TELA INTEIRA (mockup aprovado): a área grande de soltar saiu;
       soltar um arquivo em qualquer lugar da página abre o mesmo fluxo de upload. */
    <div className="pb-20 md:pb-0 relative"
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={handleDrop}>
      {dragOver && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/20 backdrop-blur-[2px] pointer-events-none">
          <div className="rounded-2xl border-2 border-foreground bg-card px-6 py-5 shadow-[6px_6px_0_hsl(var(--foreground))] text-center">
            <Upload className="h-6 w-6 mx-auto mb-1.5" />
            <p className="font-display font-extrabold text-lg">Solte pra enviar</p>
            <p className="text-xs font-body text-muted-foreground">Máximo 50MB por arquivo</p>
          </div>
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Topo: título, cota numa linha, Drive e Enviar. */}
        <div data-tour="arquivos-topo" className="flex items-center gap-2.5 flex-wrap mb-4">
          <h1 className="md:hidden text-[26px] font-display font-extrabold text-foreground tracking-tight mr-1">Arquivos</h1>
          <span data-tour="arquivos-cota" title={`${Math.round(usagePct)}% usado`}
            className="order-3 sm:order-none inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-3 h-8 text-[12px] font-body font-bold tabular-nums">
            {formatStorage(storageUsed)} de {formatStorage(storageQuota)}
            <span className="h-2 w-14 rounded-full border border-foreground bg-background overflow-hidden">
              <span className={cn("block h-full", usagePct >= 80 ? "bg-red-500" : usagePct >= 60 ? "bg-amber-500" : "bg-[#00A652]")} style={{ width: `${Math.max(3, usagePct)}%` }} />
            </span>
          </span>
          {upgradeStorage && usagePct >= 60 && (
            <button type="button" onClick={() => navigate(`/app/assinar?plano=${upgradeStorage.plano}`)}
              className="order-4 sm:order-none text-[11.5px] text-muted-foreground hover:text-primary font-body inline-flex items-center gap-1">
              <Crown className="h-3 w-3" /> No {upgradeStorage.nome} são {upgradeStorage.espaco}
            </button>
          )}
          <div className="order-2 sm:order-none ml-auto flex items-center gap-2">
            <span className="hidden sm:inline-flex"><DrivePickerButton onPicked={() => refetchDrive()} variant="outline" size="sm" /></span>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || isStorageFull}
              className="rounded-full border-2 border-foreground bg-[#EB4918] hover:bg-[#d8410f] text-white font-extrabold shadow-[3px_3px_0_hsl(var(--foreground))]">
              <Plus className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : <><span className="sm:hidden">Enviar</span><span className="hidden sm:inline">Enviar arquivo</span></>}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Busca grande: nome do arquivo ou título do post onde foi usado. */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome do arquivo ou pelo post onde foi usado"
            className="w-full h-12 rounded-xl border-2 border-foreground bg-card pl-11 pr-4 text-[14px] font-body outline-none shadow-[3px_3px_0_hsl(var(--foreground))] focus:shadow-[3px_3px_0_#EB4918]" />
        </div>

        {/* A GAVETA: abas por tipo coladas no corpo. */}
        <div data-tour="arquivos-abas" className="flex items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pl-2 -mb-[2px] relative z-10">
          {ABAS.map((a) => {
            const on = aba === a.k;
            return (
              <button key={a.k} type="button" onClick={() => setAba(a.k)} aria-pressed={on}
                className={cn("shrink-0 rounded-t-lg border-2 border-foreground px-3 sm:px-4 text-[12px] sm:text-[13px] font-body font-extrabold text-[#1d1b18] transition-all",
                  on ? "h-10 border-b-card" : "h-8 opacity-80 hover:opacity-100")}
                style={{ background: on && a.k === "tudo" ? "hsl(var(--card))" : a.cor }}>
                {a.rotulo} <span className="font-semibold opacity-60 tabular-nums">{contagem(a.k)}</span>
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl rounded-tl-none border-2 border-foreground bg-card shadow-[6px_6px_0_hsl(var(--foreground))] p-3 sm:p-4">
          {/* Origem: posts, uploads e as categorias que já existiam. */}
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-3">
            {[
              { k: "todas", r: "Todas as origens", n: porBusca.length },
              { k: "posts", r: "Dos posts", n: porBusca.filter((f) => f.origem === "posts").length },
              { k: "uploads", r: "Meus uploads", n: porBusca.filter((f) => f.origem === "upload").length },
              ...CATEGORIES.filter((c) => c !== "geral" && porBusca.some((f) => f.categoria === c)).map((c) => ({ k: c, r: c[0].toUpperCase() + c.slice(1), n: -1 })),
            ].map((o) => (
              <button key={o.k} type="button" onClick={() => setOrigem(o.k)} aria-pressed={origem === o.k}
                className={cn("shrink-0 h-7 rounded-full border-2 border-foreground px-3 text-[11.5px] font-body font-bold",
                  origem === o.k ? "bg-foreground text-background" : "bg-card text-foreground")}>
                {o.r}{o.n >= 0 && <span className="ml-1 opacity-60 tabular-nums">{o.n}</span>}
              </button>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-foreground/30 py-14 text-center">
              <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-display font-extrabold text-[17px]">
                {itens.length === 0 ? "Seus arquivos aparecem aqui" : "Nada com esse filtro"}
              </p>
              <p className="text-[13px] font-body text-muted-foreground mt-1">
                {itens.length === 0 ? "Envie imagens, PDFs e referências, ou arraste pra cá." : aba === "vencendo" ? "Nenhum arquivo temporário some nos próximos 7 dias." : "Troque a aba, a origem ou limpe a busca."}
              </p>
            </div>
          ) : (
            <>
              <div data-tour="arquivos-grade" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {mostradas.map((f) => (
                  <FichaArquivo key={f.chave} f={f} resolver={getPublicUrl} onAbrir={() => void abrirFicha(f)} onApagar={() => void apagarFicha(f)} />
                ))}
              </div>
              {visiveis.length > mostradas.length && (
                <div className="flex justify-center pt-4">
                  <button type="button" onClick={() => setQuantos((q) => q + PASSO)}
                    className="h-9 rounded-full border-2 border-foreground bg-card px-5 text-[12.5px] font-body font-extrabold shadow-[3px_3px_0_hsl(var(--foreground))]">
                    Ver mais {Math.min(PASSO, visiveis.length - mostradas.length)} de {visiveis.length - mostradas.length}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <UserLinksSection />

        <p className="text-center text-[12px] font-body italic text-muted-foreground mt-5">
          arraste arquivos em qualquer lugar desta tela pra enviar · temporários somem em {retentionDays} dias
        </p>
      </motion.div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Categorizar arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm font-body text-muted-foreground truncate">{pendingFile?.name}</p>
            {pendingFile && (
              <p className="text-xs text-muted-foreground font-body">
                Tamanho: {formatSize(pendingFile.size)}
              </p>
            )}
            <div className="space-y-2">
              <Label className="font-body text-sm">Categoria</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setPendingCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-body border capitalize transition-colors ${
                      pendingCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-sm">Armazenamento</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingPermanent(false)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-body border transition-colors ${
                    !pendingPermanent ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                  }`}
                >
                  Temporário ({retentionDays} dias)
                </button>
                <button
                  onClick={() => setPendingPermanent(true)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-body border transition-colors ${
                    pendingPermanent ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                  }`}
                >
                  Permanente
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground font-body">
                Permanente ocupa sua cota e não é apagado. Temporário some em {retentionDays} dias.
              </p>
            </div>
            <Button
              variant="hero"
              className="w-full"
              onClick={() => {
                setCategoryDialogOpen(false);
                if (pendingFile) handleUpload(pendingFile, pendingCategory, pendingPermanent);
              }}
            >
              Enviar arquivo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewModal
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        kind={preview?.kind ?? "none"}
        url={preview?.url ?? null}
        name={preview?.name ?? ""}
      />
    </div>
  );
};

export default Arquivos;
