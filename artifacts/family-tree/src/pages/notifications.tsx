import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useGetNotifications, 
  getGetNotificationsQueryKey,
  useMarkNotificationsRead 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tag, MessageCircle, Heart, Cake, Info, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Notifications() {
  const { familyId } = useAuth();
  const [filter, setFilter] = useState("all");
  const qc = useQueryClient();
  
  const { data: notificationsData, isLoading } = useGetNotifications(
    familyId ?? "", 
    filter === "unread" ? { unreadOnly: true } : {}, 
    { query: { enabled: !!familyId, queryKey: getGetNotificationsQueryKey(familyId ?? "", filter === "unread" ? { unreadOnly: true } : {}) } }
  );
  
  const markRead = useMarkNotificationsRead();
  
  const notifications = (notificationsData as any)?.items || notificationsData || [];
  
  const handleMarkAllRead = () => {
    markRead.mutate({ familyId: familyId ?? "", data: {} }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey(familyId ?? "", {}) });
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey(familyId ?? "", { unreadOnly: true }) });
      }
    });
  };
  
  const handleMarkRead = (id: string) => {
    markRead.mutate({ familyId: familyId ?? "", data: { ids: [id] } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey(familyId ?? "", {}) });
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey(familyId ?? "", { unreadOnly: true }) });
      }
    });
  };
  
  const getIcon = (type: string) => {
    switch (type) {
      case "tag": return <Tag className="w-5 h-5 text-blue-500" />;
      case "comment": return <MessageCircle className="w-5 h-5 text-green-500" />;
      case "reaction": return <Heart className="w-5 h-5 text-red-500" />;
      case "birthday": return <Cake className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-slate-500" />;
    }
  };
  
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markRead.isPending}>
          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark all read
        </Button>
      </div>
      
      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-medium">All caught up</h2>
          <p className="text-muted-foreground">You have no new notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: any) => (
            <div 
              key={n.id} 
              className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${n.read ? 'bg-card border-border/50 opacity-70' : 'bg-primary/5 border-primary/20 hover:bg-primary/10'}`}
              onClick={() => !n.read && handleMarkRead(n.id)}
            >
              <div className="mt-1 flex-shrink-0 bg-background rounded-full p-2 border shadow-sm">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{n.title || n.message}</p>
                {n.title && <p className="text-sm text-muted-foreground truncate">{n.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
              </div>
              {!n.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
