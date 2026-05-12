import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { profile, isLoading } = useProfile();

  if (isLoading) return <PageSkeleton />;
  if (profile?.role !== "admin") return <Navigate to="/app" replace />;

  return <>{children}</>;
}
