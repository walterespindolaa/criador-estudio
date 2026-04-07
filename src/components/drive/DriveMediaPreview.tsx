import { FileText, Image, Video, X, ExternalLink } from "lucide-react";

interface DriveMediaPreviewProps {
  fileName: string;
  fileType?: string | null;
  thumbnailUrl?: string | null;
  viewUrl?: string | null;
  size?: "sm" | "md";
  onRemove?: () => void;
}

export function DriveMediaPreview({ fileName, fileType, thumbnailUrl, viewUrl, size = "md", onRemove }: DriveMediaPreviewProps) {
  const isImage = fileType?.startsWith("image/");
  const isVideo = fileType?.startsWith("video/");
  const dim = size === "sm" ? "w-16 h-16" : "w-24 h-24";

  return (
    <div className="group relative inline-flex flex-col items-center">
      <a
        href={viewUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={`${dim} rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary transition-all`}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-cover" />
        ) : isImage ? (
          <Image className="h-6 w-6 text-muted-foreground" />
        ) : isVideo ? (
          <Video className="h-6 w-6 text-muted-foreground" />
        ) : (
          <FileText className="h-6 w-6 text-muted-foreground" />
        )}
      </a>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <p className="text-[10px] text-muted-foreground font-body mt-1 max-w-[80px] truncate text-center">{fileName}</p>
    </div>
  );
}
