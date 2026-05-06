import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, role, status, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (status === "pending") return <Navigate to="/pending" replace />;
  if (status === "rejected") return <Navigate to="/pending" replace />;
  if (requireAdmin && role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
