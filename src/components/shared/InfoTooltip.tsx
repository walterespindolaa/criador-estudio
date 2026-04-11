import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function InfoTooltip({ text, side = "top", className = "" }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center p-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
            style={{ padding: '8px' }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          className="z-[9999] max-w-[220px] text-[13px] font-body leading-relaxed border-none rounded-lg shadow-lg data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1"
          style={{ 
            backgroundColor: 'rgba(30, 30, 30, 0.95)', 
            color: '#ffffff',
            fontSize: '13px',
            padding: '8px 12px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 9999,
            maxWidth: '220px',
            whiteSpace: 'normal',
            pointerEvents: 'none',
            transitionDuration: '150ms',
            transitionTimingFunction: 'ease-out'
          }}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

