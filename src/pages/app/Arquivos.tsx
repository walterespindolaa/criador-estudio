import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Upload, Search, Trash2, FileText, Image, File, Plus, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileItem {
  id: string;
  name: string;
  storage_path: string;
  file_type: string | null;
  size_bytes: number | null;
  category: string | null;
  tags: string[] | null;
  post_id: string | null;
  created_at: string;
}

const CATEGORIES = ["geral", "referência", "marca", "inspiração", "roteiro"];

const Arquivos = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchFiles = async () => {
    if (!user) return;
    const { data } = await supabase.from("files").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setFiles((data as any[]) || []);
  };

  useEffect(() => { fetchFiles(); }, [user]);

  const uploadFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("files").upload(path, file);
    if (uploadError) { toast.error("Erro no upload."); setUploading(false); return; }

    await supabase.from("files").insert({
      user_id: user.id,
      name: file.name,
      storage_path: path,
      file_type: file.type,
      size_bytes: file.size,
      category: "geral",
    } as any);
    toast.success("Arquivo enviado!");
    setUploading(false);
    fetchFiles();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const deleteFile = async (f: FileItem) => {
    await supabase.storage.from("files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    setFiles(prev => prev.filter(x => x.id !== f.id));
    toast.success("Arquivo removido.");
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("files").getPublicUrl(path);
    return data.publicUrl;
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

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Arquivos</h1>
            <p className="text-muted-foreground font-body mt-1">Seus arquivos e referências visuais.</p>
          </div>
          <Button variant="hero" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Upload"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center mb-6 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">Arraste arquivos aqui ou clique em Upload</p>
        </div>

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
        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
            <FolderOpen className="h-8 w-8 text-primary mx-auto mb-3" />
            <p className="text-lg font-display font-semibold text-foreground mb-2">
              {files.length === 0 ? "Seus arquivos aparecem aqui" : "Nenhum arquivo encontrado"}
            </p>
            <p className="text-muted-foreground font-body text-sm">
              {files.length === 0 ? "Faça upload de imagens, PDFs e referências." : "Tente mudar os filtros."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((f, i) => (
              <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-card rounded-xl border border-border overflow-hidden group">
                {/* Preview */}
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
                    <button onClick={() => deleteFile(f)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-opacity">
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
        )}
      </motion.div>
    </div>
  );
};

export default Arquivos;
