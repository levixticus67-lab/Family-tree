import { createContext, useContext, type ReactNode, useEffect } from "react";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  familyId: string | null;
  isGatekeeper: boolean;
  isMasterAdmin: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      retry: false,
      queryKey: getGetCurrentUserQueryKey(),
    }
  });

  const familyId = user?.familyId ?? null;
  const isGatekeeper = user?.role === "gatekeeper" || user?.role === "master_admin";
  const isMasterAdmin = user?.role === "master_admin";

  const logout = () => {
    localStorage.removeItem("auth_token");
    qc.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, familyId, isGatekeeper, isMasterAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [user, isLoading, setLocation]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, isMasterAdmin } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || !isMasterAdmin)) setLocation("/app");
  }, [user, isLoading, isMasterAdmin, setLocation]);

  if (isLoading) return <LoadingScreen />;
  if (!isMasterAdmin) return null;
  return <>{children}</>;
}

export function GatekeeperRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, isGatekeeper } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || !isGatekeeper)) setLocation("/app");
  }, [user, isLoading, isGatekeeper, setLocation]);

  if (isLoading) return null;
  if (!isGatekeeper) return null;
  return <>{children}</>;
}
