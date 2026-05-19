import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useLocation as useNavigate } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeSelector } from "./ThemeSelector";
import {
  Home,
  Network,
  Image as ImageIcon,
  MessageSquare,
  Calendar,
  Map as MapIcon,
  Archive,
  Bell,
  ShieldAlert,
  LogOut,
  Settings,
  Search,
  X,
} from "lucide-react";
import { useLogoutUser, useGetNotifications, getGetNotificationsQueryKey, useListMembers, getListMembersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/tree", label: "Family Tree", icon: Network },
  { href: "/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/map", label: "World Map", icon: MapIcon },
  { href: "/capsules", label: "Time Capsules", icon: Archive },
];

export function Sidebar() {
  const [location] = useLocation();
  const [, navigate] = useNavigate();
  const { isGatekeeper, isMasterAdmin, familyId } = useAuth();
  const logout = useLogoutUser();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: notifications } = useGetNotifications(
    familyId ?? "",
    { unreadOnly: true },
    { query: { enabled: !!familyId, queryKey: getGetNotificationsQueryKey(familyId ?? "", { unreadOnly: true }) } }
  );

  const { data: allMembers = [] } = useListMembers(familyId ?? "", {
    query: { enabled: !!familyId && searchOpen, queryKey: getListMembersQueryKey(familyId ?? "") }
  });

  const unreadCount = Array.isArray(notifications) ? notifications.length : 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
        setSearchQuery("");
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const filteredMembers = (allMembers as any[]).filter((m: any) =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    });
  };

  const handleMemberClick = (memberId: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/profile/${memberId}`);
  };

  return (
    <>
      <aside className="w-64 flex-shrink-0 flex flex-col glass-panel m-4 rounded-xl overflow-hidden border-border/50 relative z-10">
        <div className="p-6 pb-3">
          <h1 className="text-2xl font-bold font-sans tracking-tight text-primary">Sanctuary</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your family's private space</p>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={() => { setSearchOpen(true); setSearchQuery(""); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground bg-muted/50 hover:bg-muted transition-colors border border-border/50"
            data-testid="sidebar-search-trigger"
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left">Find a family member…</span>
            <kbd className="text-[10px] bg-background border border-border rounded px-1.5 py-0.5 font-mono hidden sm:inline">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-foreground/80 hover:bg-black/5 hover:text-foreground"}`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/notifications"
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${location === "/notifications" ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-foreground/80 hover:bg-black/5 hover:text-foreground"}`}
            data-testid="nav-notifications"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none" data-testid="notification-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </nav>

        <div className="p-4 space-y-2">
          {isGatekeeper && (
            <Link
              href="/gatekeeper"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-50 transition-colors"
              data-testid="nav-gatekeeper"
            >
              <ShieldAlert className="w-4 h-4" />
              Gatekeeper
            </Link>
          )}

          {isMasterAdmin && (
            <Link
              href="/system-cockpit"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
              data-testid="nav-cockpit"
            >
              <Settings className="w-4 h-4" />
              System Cockpit
            </Link>
          )}

          <div className="px-3">
            <ThemeSelector />
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          onClick={(e) => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQuery(""); } }}
        >
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden mx-4">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search family members…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No members match your search" : "Start typing to find a family member"}
                </div>
              ) : (
                filteredMembers.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => handleMemberClick(m.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0 overflow-hidden">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.firstName} className="w-full h-full object-cover" />
                      ) : (
                        `${m.firstName?.[0] ?? ""}${m.lastName?.[0] ?? ""}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.firstName} {m.lastName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Press <kbd className="font-mono bg-background border border-border px-1 rounded text-[10px]">Esc</kbd> to close &bull; Click a member to view their profile</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
