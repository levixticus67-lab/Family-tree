import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListCapsules, getListCapsulesQueryKey } from "@workspace/api-client-react";
import { Lock, Unlock, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

function Countdown({ unlockAt }: { unlockAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  
  useEffect(() => {
    const target = new Date(unlockAt).getTime();
    
    const update = () => {
      const now = new Date().getTime();
      const diff = target - now;
      
      if (diff <= 0) {
        setTimeLeft("Unlocking soon...");
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${days}d ${hours}h ${mins}m`);
    };
    
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [unlockAt]);
  
  return <span className="font-mono tabular-nums">{timeLeft}</span>;
}

export default function Capsules() {
  const { familyId } = useAuth();
  
  const { data: capsulesData, isLoading } = useListCapsules(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListCapsulesQueryKey(familyId ?? "") }
  });
  
  const capsules = (capsulesData as any)?.items || capsulesData || [];
  
  const now = new Date().toISOString();
  const locked = capsules.filter((c: any) => c.unlockAt > now).sort((a: any, b: any) => a.unlockAt.localeCompare(b.unlockAt));
  const unlocked = capsules.filter((c: any) => c.unlockAt <= now).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">Time Capsules</h1>
        <p className="text-muted-foreground">Messages and memories preserved for the future.</p>
      </div>
      
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : capsules.length === 0 ? (
        <div className="text-center py-24 bg-card border border-dashed rounded-xl">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground opacity-40 mb-4" />
          <h2 className="text-lg font-medium">No Time Capsules</h2>
          <p className="text-muted-foreground">Create a post and mark it as a Time Capsule to preserve it.</p>
        </div>
      ) : (
        <>
          {locked.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-amber-500" />
                <h2 className="text-2xl font-semibold">Locked Vault</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {locked.map((c: any) => (
                  <div key={c.id} className="relative overflow-hidden rounded-xl border border-border bg-card p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-md z-10" />
                    <div className="relative z-20 flex flex-col items-center space-y-4">
                      <div className="bg-amber-100 text-amber-700 p-3 rounded-full">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Unlocks in</div>
                        <div className="text-2xl font-bold tracking-tight text-foreground">
                          <Countdown unlockAt={c.unlockAt} />
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        From {c.authorName} &bull; {format(new Date(c.unlockAt), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {unlocked.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Unlock className="w-5 h-5 text-emerald-500" />
                <h2 className="text-2xl font-semibold">Unlocked Memories</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {unlocked.map((c: any) => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-semibold">{c.authorName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Revealed {formatDistanceToNow(new Date(c.unlockAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="bg-emerald-100 text-emerald-700 p-2 rounded-full">
                        <Unlock className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap">{c.content}</p>
                    {c.mediaUrls?.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {c.mediaUrls.map((url: string, i: number) => (
                          <img key={i} src={url} className="rounded-lg object-cover w-full h-32" alt="Capsule media" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
