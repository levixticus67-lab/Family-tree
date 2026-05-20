import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import {
  GitBranch, Users, TreePine, Activity, Search, Shield,
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Clock,
  LogOut, ChevronRight, Database, BarChart3
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface SystemStats {
  totalFamilies: number;
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  totalPosts: number;
  totalMedia: number;
}

interface FamilyRow {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
  gatekeeperId: string;
}

interface AuditLog {
  id: string;
  action: string;
  userId: string | null;
  familyId: string | null;
  details: string | null;
  timestamp: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"overview" | "families" | "activity">("overview");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, f, l] = await Promise.all([
        apiGet<SystemStats>("/api/system-cockpit/stats"),
        apiGet<FamilyRow[]>("/api/system-cockpit/families"),
        apiGet<AuditLog[]>("/api/system-cockpit/audit-logs?limit=50"),
      ]);
      setStats(s);
      setFamilies(f);
      setAuditLogs(l);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const filteredFamilies = families.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statCards = stats
    ? [
        { label: "Total Families", value: stats.totalFamilies, icon: TreePine, color: "hsl(190, 100%, 50%)" },
        { label: "Total Users", value: stats.totalUsers, icon: Users, color: "hsl(250, 80%, 65%)" },
        { label: "Active Users", value: stats.activeUsers, icon: CheckCircle, color: "hsl(140, 60%, 50%)" },
        { label: "Pending Approval", value: stats.pendingUsers, icon: Clock, color: "hsl(40, 90%, 55%)" },
        { label: "Total Posts", value: stats.totalPosts, icon: Activity, color: "hsl(200, 80%, 55%)" },
        { label: "Media Files", value: stats.totalMedia, icon: Database, color: "hsl(340, 75%, 62%)" },
      ]
    : [];

  const actionColors: Record<string, string> = {
    "user.register": "hsl(140, 60%, 50%)",
    "user.login": "hsl(200, 80%, 55%)",
    "family.create": "hsl(190, 100%, 50%)",
    "member.create": "hsl(250, 80%, 65%)",
    "member.approve": "hsl(140, 60%, 50%)",
    "member.reject": "hsl(0, 72%, 51%)",
    "invite.create": "hsl(40, 90%, 55%)",
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* HEADER */}
      <header
        className="sticky top-0 z-10 h-14 border-b border-border/50 flex items-center px-6 gap-4"
        style={{
          background: "hsl(var(--card) / 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Admin Dashboard</span>
        </div>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {(["overview", "families", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/app">
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs border border-border/50 hover:bg-muted/40 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Tree
            </button>
          </Link>
          <ThemeToggle />
          <div className="relative group">
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 overflow-hidden"
              style={{
                borderColor: "hsl(var(--primary) / 0.3)",
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
              }}
            >
              {(user?.displayName ?? "?")[0]}
            </button>
            <div
              className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border/60 shadow-xl py-1.5 z-50 invisible group-hover:visible"
              style={{ background: "hsl(var(--card))" }}
            >
              <div className="px-3 py-2 border-b border-border/40 mb-1">
                <p className="text-xs font-medium">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground">master_admin</p>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 text-destructive transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-12 h-12 rounded-full border-2 border-t-primary animate-spin"
                style={{ borderColor: "hsl(var(--border))", borderTopColor: "hsl(var(--primary))" }}
              />
              <p className="text-sm text-muted-foreground">Loading platform data…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ─── OVERVIEW ─────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                <div>
                  <h1 className="font-serif text-3xl font-bold mb-1">Platform Overview</h1>
                  <p className="text-muted-foreground text-sm">
                    Real-time metrics across all registered family accounts
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {statCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-2xl border border-border/50 p-5 hover:border-primary/30 transition-colors"
                      style={{ background: "hsl(var(--card))" }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: `${card.color}18` }}
                      >
                        <card.icon className="w-4 h-4" style={{ color: card.color }} />
                      </div>
                      <p
                        className="text-2xl font-bold mb-0.5"
                        style={{ color: card.color }}
                      >
                        {card.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent activity preview */}
                <div
                  className="rounded-2xl border border-border/50 overflow-hidden"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Recent Activity
                    </h2>
                    <button
                      onClick={() => setActiveTab("activity")}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-border/30">
                    {auditLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: actionColors[log.action] ?? "hsl(var(--muted-foreground))" }}
                        />
                        <span className="text-xs font-mono text-muted-foreground flex-shrink-0 w-36 truncate">
                          {log.action}
                        </span>
                        <span className="text-xs text-foreground flex-1 truncate">
                          {log.details ?? log.userId ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {format(new Date(log.timestamp), "MMM d, HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── FAMILIES ─────────────────────────────────────────── */}
            {activeTab === "families" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="font-serif text-3xl font-bold mb-1">Family Directory</h1>
                    <p className="text-muted-foreground text-sm">
                      {families.length} registered family ecosystems
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search families…"
                      className="pl-8 h-9 text-sm bg-background/60 border-border/50"
                    />
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-border/50 overflow-hidden"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/40" style={{ background: "hsl(var(--muted) / 0.4)" }}>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">
                          Family Name
                        </th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider hidden md:table-cell">
                          Members
                        </th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider hidden lg:table-cell">
                          Created
                        </th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredFamilies.map((f) => (
                        <tr key={f.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                style={{
                                  background: "hsl(var(--primary) / 0.12)",
                                  color: "hsl(var(--primary))",
                                }}
                              >
                                {f.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{f.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{f.id.slice(0, 8)}…</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              {f.memberCount}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                            {format(new Date(f.createdAt), "MMM d, yyyy")}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                background: "hsl(140, 60%, 50% / 0.12)",
                                color: "hsl(140, 60%, 45%)",
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ background: "hsl(140, 60%, 50%)" }}
                              />
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredFamilies.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted-foreground">
                            {searchQuery ? "No families match your search." : "No families registered yet."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── ACTIVITY LOG ─────────────────────────────────────── */}
            {activeTab === "activity" && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-serif text-3xl font-bold mb-1">Activity Log</h1>
                  <p className="text-muted-foreground text-sm">
                    Latest {auditLogs.length} platform events
                  </p>
                </div>

                <div
                  className="rounded-2xl border border-border/50 overflow-hidden"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <div className="divide-y divide-border/30">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/10 transition-colors">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{
                            background:
                              actionColors[log.action] ?? "hsl(var(--muted-foreground))",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-0.5">
                            <span
                              className="text-xs font-mono font-medium px-2 py-0.5 rounded"
                              style={{
                                background: `${actionColors[log.action] ?? "hsl(var(--muted))"}18`,
                                color: actionColors[log.action] ?? "hsl(var(--muted-foreground))",
                              }}
                            >
                              {log.action}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.timestamp), "MMM d, yyyy · h:mm a")}
                            </span>
                          </div>
                          {log.details && (
                            <p className="text-xs text-muted-foreground truncate">{log.details}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/60">
                            {log.userId && <span>User: {log.userId.slice(0, 8)}…</span>}
                            {log.familyId && <span>Family: {log.familyId.slice(0, 8)}…</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                        No activity logs yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
