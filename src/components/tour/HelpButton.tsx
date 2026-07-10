/**
 * Botão "?" da barra superior — reabre o tour da tela atual quando quiser.
 */
import { CircleHelp, PlayCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTour } from "./TourProvider";

export function HelpButton({ light = false }: { light?: boolean }) {
  const { startTour, hasTourForRoute } = useTour();
  const location = useLocation();
  const available = hasTourForRoute(location.pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Ajuda e tutorial"
          className={
            light
              ? "rounded-xl p-2 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              : "rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          }
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          disabled={!available}
          onClick={() => startTour()}
          className="gap-2 font-body"
        >
          <PlayCircle className="h-4 w-4" />
          {available ? "Ver tutorial desta tela" : "Tutorial em breve nesta tela"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default HelpButton;
