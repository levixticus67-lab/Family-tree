import { Component, type ReactNode } from "react";
  import { Switch, Route, Router as WouterRouter } from "wouter";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { Toaster } from "@/components/ui/toaster";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import { AuthProvider, ProtectedRoute, AdminRoute } from "@/contexts/AuthContext";
  import NotFound from "@/pages/not-found";

  import Landing from "@/pages/landing";
  import Login from "@/pages/login";
  import Register from "@/pages/register";
  import TreeWorkspace from "@/pages/tree-workspace";
  import AdminPanel from "@/pages/admin-panel";
  import Chat from "@/pages/chat";

  // ── Error Boundary ────────────────────────────────────────────────────────────
  interface EBState { error: Error | null }
  class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
    state: EBState = { error: null };
    static getDerivedStateFromError(error: Error): EBState { return { error }; }
    render() {
      if (this.state.error) {
        return (
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#0d0f1a",
              color: "#e2e8f0",
              fontFamily: "sans-serif",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Something went wrong
            </h1>
            <pre
              style={{
                maxWidth: "600px",
                background: "#1e2235",
                borderRadius: "0.5rem",
                padding: "1rem",
                fontSize: "0.75rem",
                color: "#f87171",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                textAlign: "left",
              }}
            >
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "1.5rem",
                padding: "0.5rem 1.5rem",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Reload
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  }

  // ── App ───────────────────────────────────────────────────────────────────────
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 2 * 60 * 1000,
      },
    },
  });

  function Router() {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/app">
          <ProtectedRoute>
            <TreeWorkspace />
          </ProtectedRoute>
        </Route>
        <Route path="/app/chat">
          <ProtectedRoute>
            <div className="h-screen">
              <Chat />
            </div>
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <AdminRoute>
            <AdminPanel />
          </AdminRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  function App() {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  export default App;
  