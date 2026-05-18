import { createContext, useContext, type ReactNode, useEffect } from "react";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  familyId: string | null;
  isGatekeeper: boolean;
  isMasterAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      retry: false,
      queryKey: getGetCurrentUserQueryKey(),
    }
  });

  const familyId = user?.familyId ?? null;
  const isGatekeeper = user?.role === "gatekeeper" || user?.role === "master_admin";
  const isMasterAdmin = user?.role === "master_admin";

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, familyId, isGatekeeper, isMasterAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return null;

  return <>{children}</>;
}

export function GatekeeperRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, isGatekeeper } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || !isGatekeeper)) {
      setLocation("/feed");
    }
  }, [user, isLoading, isGatekeeper, setLocation]);

  if (isLoading) return null;
  if (!isGatekeeper) return null;

  return <>{children}</>;
}
