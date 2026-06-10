import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Upload, Search, Trash2, FileText, Cloud, ImageIcon, Crown, Clock } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { storageBytesForPlan, formatStorage } from "@/lib/plans";
import type { Database } from "@/integrations/supabase/types";

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



const Arquivos = () => {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const ownerId = activeAccountId || user?.id || "";
  const queryClient = useQueryClient();
  // Barra de cota reflete a CONTA ATIVA (o dono dos arquivos).
  // NÃO usar pra gate de billing — só exibição.
  const { profile: activeProfile } = useActiveProfile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files, uploadFile, deleteFile, getPublicUrl } = useFiles();
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ kind: "image" | "iframe" | "none"; url: string | null; name: string } | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState("geral");
  const [pendingPermanent, setPendingPermanent] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const storageUsed = activeProfile?.storage_used_bytes ?? 0;
  const storageQuota = activeProfile?.storage_quota_bytes ?? storageBytesForPlan(null, false);
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
      if (ref.provider === "bunny" && ref.external_file_id) {
        try {
          const { error } = await supabase.functions.invoke("bunny-delete-video", {
            body: { videoGuid: ref.external_file_id, accountId: ownerId },
          });
          if (error) console.error("[bunny-delete-video] invoke error", error);
        } catch (e) {
          console.error("[bunny-delete-video] invoke threw", e);
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

  const filteredUploads = uploads.filter((f) => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || f.category === catFilter;
    return matchSearch && matchCat;
  });

  const filteredPermanent = filteredUploads.filter((f) => !f.expires_at);
  const filteredTemporary = filteredUploads.filter((f) => !!f.expires_at);

  const filteredDrive = (driveFiles ?? []).filter((f) =>
    !search || f.file_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-sm shrink-0">
              <FolderOpen className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Arquivos</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm">Seus arquivos e referências visuais.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DrivePickerButton onPicked={() => refetchDrive()} variant="outline" size="sm" />
            <Button variant="hero" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || isStorageFull}>
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Upload"}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Storage usage bar */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 mb-4 flex items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-body mb-1.5">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatStorage(storageUsed)}</span> de {formatStorage(storageQuota)} usados
              </span>
              <span className="text-muted-foreground tabular-nums">{Math.round(usagePct)}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                style={{ width: `${usagePct}%` }}
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePct >= 80 ? "bg-red-500" : usagePct >= 60 ? "bg-amber-500" : "bg-primary"
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/assinar")}
              className="mt-2 text-[11px] text-muted-foreground hover:text-primary font-body inline-flex items-center gap-1 transition-colors"
            >
              <Crown className="h-3 w-3" />
              Quer mais espaço? Upgrade para Pro → +250MB
            </button>
          </div>
        </div>

        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center mb-3 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">Arraste arquivos aqui ou clique em Upload</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Máximo 50MB por arquivo</p>
        </div>
        <p className="text-xs text-muted-foreground font-body text-center mb-6">
          💡 Arquivos temporários somem em {retentionDays} dias. Escolha "Permanente" no upload pra manter — ocupa sua cota.
        </p>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar arquivos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setCatFilter(null)} className={`px-3 py-1.5 rounded-xl text-xs font-body border capitalize transition-colors ${!catFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)} className={`px-3 py-1.5 rounded-xl text-xs font-body border capitalize transition-colors ${catFilter === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{c}</button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {filteredUploads.length === 0 && filteredDrive.length === 0 ? (
          <div className="bg-card rounded-xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
            <FolderOpen className="h-8 w-8 text-primary mx-auto mb-3" />
            <p className="text-lg font-display font-semibold text-foreground mb-2">
              {uploads.length === 0 && (driveFiles ?? []).length === 0 ? "Seus arquivos aparecem aqui" : "Nenhum arquivo encontrado"}
            </p>
            <p className="text-muted-foreground font-body text-sm">
              {uploads.length === 0 && (driveFiles ?? []).length === 0 ? "Faça upload de imagens, PDFs e referências." : "Tente mudar os filtros."}
            </p>
          </div>
        ) : (
          <>
            {(() => {
              const openUpload = async (f: typeof filteredUploads[number]) => {
                const url = await getPublicUrl(f.storage_path);
                if (!url) { toast.error("Não foi possível abrir o arquivo."); return; }
                if (isImage(f.file_type)) {
                  setPreview({ kind: "image", url, name: f.name });
                } else {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              };
              const renderUploadCard = (f: typeof filteredUploads[number], i: number) => {
                const dleft = daysUntilExpiry(f.expires_at);
                return (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => openUpload(f)}
                    className="bg-card rounded-xl border border-border overflow-hidden group cursor-pointer hover:shadow-warm-md hover:border-primary/30 transition-all"
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {isImage(f.file_type) ? (
                        <SignedImage path={f.storage_path} alt={f.name} resolve={getPublicUrl} />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-body font-medium text-foreground truncate">{f.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground font-body">{formatSize(f.size_bytes)}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(f); }} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-opacity">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {f.category && f.category !== "geral" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-muted text-muted-foreground capitalize">{f.category}</span>
                        )}
                        {dleft !== null && (
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-body",
                              dleft < 7 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {dleft <= 0 ? "Expira hoje" : `Expira em ${dleft}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              };
              return (
                <>
                  {/* Seção 1 — Permanentes (expires_at = null) */}
                  {filteredPermanent.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-body font-semibold text-foreground mb-3 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        Permanentes
                        <span className="text-[10px] text-muted-foreground font-normal">({filteredPermanent.length})</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredPermanent.map(renderUploadCard)}
                      </div>
                    </div>
                  )}

                  {/* Seção 2 — Temporárias (expires_at preenchido) */}
                  {filteredTemporary.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-body font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Temporárias ({retentionDays} dias)
                        <span className="text-[10px] text-muted-foreground font-normal">({filteredTemporary.length})</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredTemporary.map(renderUploadCard)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Seção 2 — Mídias vinculadas (Drive + Bunny + outros providers) */}
            {filteredDrive.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-body font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-primary" />
                  Mídias vinculadas
                  <span className="text-[10px] text-muted-foreground font-normal">({filteredDrive.length})</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredDrive.map((f) => (
                    <DriveMediaPreview
                      key={f.id}
                      fileName={f.file_name}
                      fileType={f.file_type}
                      thumbnailUrl={f.thumbnail_url}
                      viewUrl={f.view_url}
                      size="md"
                      onRemove={() => deleteDriveRef(f)}
                      onOpen={() => setPreview({ kind: "iframe", url: f.view_url, name: f.file_name })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
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
