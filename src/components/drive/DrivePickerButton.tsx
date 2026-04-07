import { HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface DrivePickerButtonProps {
  postId?: string;
  onPicked?: () => void;
  variant?: "default" | "outline" | "ghost" | "hero";
  size?: "default" | "sm" | "lg" | "icon";
}

export function DrivePickerButton({ postId, onPicked, variant = "outline", size = "default" }: DrivePickerButtonProps) {
  const { pickAndSave, picking } = useGoogleDrive();

  const handleClick = async () => {
    await pickAndSave(postId);
    onPicked?.();
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={picking}>
      <HardDrive className="h-4 w-4 mr-1" />
      {picking ? "Abrindo..." : "Google Drive"}
    </Button>
  );
}
