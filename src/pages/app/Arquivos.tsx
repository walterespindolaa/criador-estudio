import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Upload, Search, Trash2, FileText, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { DrivePickerButton } from "@/components/drive/DrivePickerButton";
import { DriveMediaPreview } from "@/components/drive/DriveMediaPreview";
import { useFiles } from "@/hooks/useFiles";
import type { Database } from "@/integrations/supabase/types";

type DriveRef = Database["public"]["Tables"]["external_media_refs"]["Row"];

const CATEGORIES = ["geral", "referência", "marca", "inspiração", "roteiro"];
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

const Arquivos = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files, uploadFile, deleteFile, getPublicUrl } = useFiles();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState("geral");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const totalBytes = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  const isStorageFull = totalBytes >= MAX_TOTAL_SIZE;
  const uploading = uploadFile.isPending;

  const { data: driveFiles, refetch: refetchDrive } = useQuery<DriveRef[]>({
    queryKey: ["drive-files", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("external_media_refs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DriveRef[];
    },
    enabled: !!user,
  });

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) { toast.error("Arquivo muito grande. Limite: 1MB por arquivo."); return; }
    if (totalBytes + file.size > MAX_TOTAL_SIZE) { toast.error("Limite de armazenamento atingido (20MB)."); return; }
    setPendingFile(file);
    setPendingCategory("geral");
    setCategoryDialogOpen(true);
  };

  const handleUpload = async (file: File, category: string) => {
    try {
      await uploadFile.mutateAsync({ file, category });
      toast.success("Arquivo enviado!");
    } catch {
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

  const handleDelete = async (f: { id: string; storage_path: string }) => {
    try {
      await deleteFile.mutateAsync(f);
      toast.success("Arquivo removido.");
    } catch {
      toast.error("Erro ao remover arquivo.");
    }
  };

  const deleteDriveRef = async (id: string) => {
    const { error } = await supabase.from("external_media_refs").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover referência."); return; }
    refetchDrive();
    toast.success("Referência removida.");
  };

  const isImage = (type: string | null) => type?.startsWith("image/");

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  const filtered = files.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || f.category === catFilter;
    return matchSearch && matchCat;
  });

  const filteredDrive = (driveFiles ?? []).filter(f =>
    !search || f.file_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-sm shrink-0">
              <FolderOpen className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Arquivos</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm">Seus arquivos e referências visuais.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground font-body hidden sm:block">
              {(totalBytes / (1024 * 1024)).toFixed(1)}MB / 20MB
            </p>
            <DrivePickerButton onPicked={() => refetchDrive()} variant="outline" size="sm" />
            <Button variant="hero" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || isStorageFull}>
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Upload"}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center mb-6 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">Arraste arquivos aqui ou clique em Upload</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Máximo 1MB por arquivo</p>
        </div>

        {/* Drive files section */}
        {filteredDrive.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-body font-semibold text-foreground mb-3 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              Arquivos do Google Drive
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {filteredDrive.map(f => (
                <DriveMediaPreview
                  key={f.id}
                  fileName={f.file_name}
                  fileType={f.file_type}
                  thumbnailUrl={f.thumbnail_url}
                  viewUrl={f.view_url}
                  size="md"
                  onRemove={() => deleteDriveRef(f.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar arquivos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setCatFilter(null)} className={`px-3 py-1.5 rounded-xl text-xs font-body border capitalize transition-colors ${!catFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)} className={`px-3 py-1.5 rounded-xl text-xs font-body border capitalize transition-colors ${catFilter === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{c}</button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 && filteredDrive.length === 0 ? (
          <div className="bg-card rounded-xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
            <FolderOpen className="h-8 w-8 text-primary mx-auto mb-3" />
            <p className="text-lg font-display font-semibold text-foreground mb-2">
              {files.length === 0 ? "Seus arquivos aparecem aqui" : "Nenhum arquivo encontrado"}
            </p>
            <p className="text-muted-foreground font-body text-sm">
              {files.length === 0 ? "Faça upload de imagens, PDFs e referências." : "Tente mudar os filtros."}
            </p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((f, i) => (
              <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-card rounded-xl border border-border overflow-hidden group">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {isImage(f.file_type) ? (
                    <img src={getPublicUrl(f.storage_path)} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-body font-medium text-foreground truncate">{f.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground font-body">{formatSize(f.size_bytes)}</span>
                    <button onClick={() => handleDelete(f)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-opacity">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                  {f.category && f.category !== "geral" && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-body bg-muted text-muted-foreground capitalize">{f.category}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : null}
      </motion.div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Categorizar arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm font-body text-muted-foreground truncate">{pendingFile?.name}</p>
            <div className="space-y-2">
              <Label className="font-body text-sm">Categoria</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setPendingCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-body border capitalize transition-colors ${
                      pendingCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                    }`}>{cat}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={() => {
              setCategoryDialogOpen(false);
              if (pendingFile) handleUpload(pendingFile, pendingCategory);
            }}>
              Enviar arquivo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Arquivos;
