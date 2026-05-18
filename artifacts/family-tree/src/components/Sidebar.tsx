import { Link, useLocation } from "wouter";
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
  Settings
} from "lucide-react";
import { useLogoutUser, useGetNotifications, getGetNotificationsQueryKey } from "@workspace/api-client-react";
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
  const { isGatekeeper, isMasterAdmin, familyId } = useAuth();
  const logout = useLogoutUser();
  const { data: notifications } = useGetNotifications(
    familyId ?? "",
    { unreadOnly: true },
    { query: { enabled: !!familyId, queryKey: getGetNotificationsQueryKey(familyId ?? "", { unreadOnly: true }) } }
  );

  const unreadCount = Array.isArray(notifications) ? notifications.length : 0;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    });
  };

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col glass-panel m-4 rounded-xl overflow-hidden border-border/50 relative z-10">
      <div className="p-6">
        <h1 className="text-2xl font-bold font-sans tracking-tight text-primary">Sanctuary</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your family's private space</p>
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
  );
}
