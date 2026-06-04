import { useState } from "react";
import { FileText, Image, Video, X, Play } from "lucide-react";

interface DriveMediaPreviewProps {
  fileName: string;
  fileType?: string | null;
  thumbnailUrl?: string | null;
  viewUrl?: string | null;
  size?: "sm" | "md";
  onRemove?: () => void;
  onOpen?: () => void;
}

export function DriveMediaPreview({ fileName, fileType, thumbnailUrl, viewUrl, size = "md", onRemove, onOpen }: DriveMediaPreviewProps) {
  const isImage = fileType?.startsWith("image/");
  const isVideo = fileType?.startsWith("video/");
  const dim = size === "sm" ? "w-16 h-16" : "w-24 h-24";
  const [thumbFailed, setThumbFailed] = useState(false);

  const fallbackHref = !onOpen ? (viewUrl || "#") : undefined;
  const Wrap: React.ElementType = onOpen ? "button" : "a";
  const wrapProps: Record<string, unknown> = onOpen
    ? { type: "button", onClick: onOpen }
    : { href: fallbackHref, target: "_blank", rel: "noopener noreferrer" };

  return (
    <div className="group relative inline-flex flex-col items-center">
      <Wrap
        {...wrapProps}
        className={`${dim} rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary transition-all relative ${onOpen ? "cursor-pointer" : ""}`}
      >
        {isVideo ? (
          <>
            {thumbnailUrl && !thumbFailed ? (
              <img
                src={thumbnailUrl}
                alt={fileName}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setThumbFailed(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                <Play className="h-4 w-4 text-black ml-0.5" fill="currentColor" />
              </span>
            </div>
          </>
        ) : thumbnailUrl && !thumbFailed ? (
          <img
            src={thumbnailUrl}
            alt={fileName}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setThumbFailed(true)}
          />
        ) : isImage ? (
          <Image className="h-6 w-6 text-muted-foreground" />
        ) : isVideo ? (
          <Video className="h-6 w-6 text-muted-foreground" />
        ) : (
          <FileText className="h-6 w-6 text-muted-foreground" />
        )}
      </Wrap>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <p className="text-[10px] text-muted-foreground font-body mt-1 max-w-[80px] truncate text-center">{fileName}</p>
    </div>
  );
}
