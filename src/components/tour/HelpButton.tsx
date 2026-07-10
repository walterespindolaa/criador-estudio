/**
 * Botão "?" da barra superior — reabre o tour da tela atual quando quiser.
 */
import { CircleHelp, PlayCircle, Route } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTour } from "./TourProvider";

export function HelpButton({ light = false }: { light?: boolean }) {
  const { startTour, startTraining, hasTourForRoute } = useTour();
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          disabled={!available}
          onClick={() => startTour()}
          className="gap-2 font-body"
        >
          <PlayCircle className="h-4 w-4" />
          {available ? "Ver tutorial desta tela" : "Tutorial em breve nesta tela"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => startTraining()} className="gap-2 font-body">
          <Route className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Fazer o tour completo</span>
            <span className="text-[11px] text-muted-foreground">Todas as telas, uma por uma</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default HelpButton;
