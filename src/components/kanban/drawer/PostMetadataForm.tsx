import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORMAT_LABELS, FORMATS, PLATFORMS, STATUS_OPTIONS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

type Pillar = { id: string; name: string; color: string };

type Props = {
  platform: string;
  format: string;
  pillarId: string;
  pillars: Pillar[];
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  onPlatformChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onPillarChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onScheduledDateChange: (value: string) => void;
  onScheduledTimeChange: (value: string) => void;
};

export function PostMetadataForm({
  platform,
  format,
  pillarId,
  pillars,
  status,
  scheduledDate,
  scheduledTime,
  onPlatformChange,
  onFormatChange,
  onPillarChange,
  onStatusChange,
  onScheduledDateChange,
  onScheduledTimeChange,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-body text-sm">Plataforma</Label>
          <Select value={platform} onValueChange={onPlatformChange}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map(p => (
                <SelectItem key={p} value={p}>
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={p} size="sm" />
                    <span className="font-body capitalize">
                      {p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="font-body text-sm">Formato</Label>
          <Select value={format} onValueChange={onFormatChange}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMATS.map(f => (
                <SelectItem key={f} value={f}>{FORMAT_LABELS[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="font-body text-sm">Pilar</Label>
        <div className="flex flex-wrap gap-2">
          {pillars.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPillarChange(pillarId === p.id ? "" : p.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                pillarId === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"
              }`}
              style={pillarId === p.id ? { backgroundColor: p.color } : {}}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="font-body text-sm">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

type ScheduleProps = {
  scheduledDate: string;
  scheduledTime: string;
  onScheduledDateChange: (value: string) => void;
  onScheduledTimeChange: (value: string) => void;
};

export function PostScheduleFields({
  scheduledDate,
  scheduledTime,
  onScheduledDateChange,
  onScheduledTimeChange,
}: ScheduleProps) {
  return (
    <div className="space-y-2">
      <Label className="font-body text-sm">Data e horário agendados</Label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="date"
          value={scheduledDate}
          onChange={(e) => onScheduledDateChange(e.target.value)}
          className="rounded-xl"
        />
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="time"
            value={scheduledTime}
            onChange={(e) => onScheduledTimeChange(e.target.value)}
            className="rounded-xl pl-9"
            placeholder="HH:MM"
          />
        </div>
      </div>
    </div>
  );
}
