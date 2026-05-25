import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetMember,
  getGetMemberQueryKey,
  useGetFamilyFeed,
  getGetFamilyFeedQueryKey,
  useGetMediaGallery,
  getGetMediaGalleryQueryKey,
  useCalculateRelationship,
  getCalculateRelationshipQueryKey,
  useUpdateMember,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Calendar, Clock, Edit2, Play, Pause } from "lucide-react";
import { format } from "date-fns";

// Bar heights are computed once per component mount, not on every render.
// Previously Math.random() was called inline in JSX which caused new values
// every render cycle and could trigger unnecessary re-render cascades.
function useStableBarHeights(count: number) {
  return useMemo(
    () => Array.from({ length: count }, () => Math.max(20, Math.random() * 100)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

function AudioPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const barHeights = useStableBarHeights(20);

  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl border border-border">
      <Button variant="secondary" size="icon" className="rounded-full" onClick={() => setPlaying(!playing)}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </Button>
      <div className="flex-1 flex items-center gap-1 overflow-hidden h-8">
        {barHeights.map((height, i) => (
          <div
            key={i}
            className={`w-1 bg-primary/40 rounded-full transition-all duration-300 ${playing ? 'animate-pulse' : ''}`}
            style={{
              height: `${height}%`,
              animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>
      {playing && <audio src={url} autoPlay onEnded={() => setPlaying(false)} className="hidden" />}
    </div>
  );
}

export default function Profile() {
  const params = useParams();
  const memberId = params.memberId!;
  const { familyId, user, isGatekeeper } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: member, isLoading } = useGetMember(
    familyId ?? "",
    memberId,
    { query: { enabled: !!familyId, queryKey: getGetMemberQueryKey(familyId ?? "", memberId) } }
  );

  const { data: feed } = useGetFamilyFeed(
    familyId ?? "",
    { memberId },
    { query: { enabled: !!familyId, queryKey: getGetFamilyFeedQueryKey(familyId ?? "") } }
  );

  const { data: media } = useGetMediaGallery(
    familyId ?? "",
    { memberId },
    { query: { enabled: !!familyId, queryKey: getGetMediaGalleryQueryKey(familyId ?? "", { memberId }) } }
  );

  const updateMember = useUpdateMember();
  const [calcEnabled, setCalcEnabled] = useState(false);

  const { data: calcData } = useCalculateRelationship(
    familyId ?? "",
    { fromMemberId: user?.memberId ?? "", toMemberId: memberId },
    { query: { enabled: calcEnabled && !!familyId && !!user?.memberId && !!memberId, queryKey: getCalculateRelationshipQueryKey(familyId ?? "", { fromMemberId: user?.memberId ?? "", toMemberId: memberId }) } }
  );
  const relResult = calcData?.description ?? "";

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const doCalculate = () => {
    if (!familyId || !user?.memberId) return;
    setCalcEnabled(true);
  };

  const onSaveEdit = () => {
    if (!familyId || !member) return;
    updateMember.mutate({
      familyId,
      memberId,
      data: editData
    }, {
      onSuccess: () => {
        toast({ title: "Profile updated" });
        setEditOpen(false);
        qc.invalidateQueries({ queryKey: getGetMemberQueryKey(familyId, memberId) });
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 animate-pulse text-muted-foreground">Loading profile...</div>;
  }

  if (!member) {
    return <div className="p-8 text-center text-muted-foreground">Profile not found</div>;
  }

  const posts = (feed as any)?.posts ?? [];
  const gallery = (media as any)?.items ?? [];

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-8 h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left Col - Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 flex flex-col items-center text-center relative">
            {isGatekeeper && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => {
                  setEditData({ bio: member.bio || "", birthDate: member.birthDate || "", deathDate: member.deathDate || "", birthPlace: member.birthPlace || "" });
                  setEditOpen(true);
                }}
                data-testid="btn-edit-profile"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}

            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-lg mb-4 bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.firstName} className="w-full h-full object-cover" />
              ) : (
                `${member.firstName[0]}${member.lastName?.[0] || ""}`
              )}
            </div>

            <h1 className="text-2xl font-bold text-foreground font-sans">{member.firstName} {member.lastName}</h1>

            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-2">
              {member.birthDate && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(member.birthDate), "yyyy")}</span>
              )}
              {member.deathDate && (
                <span className="flex items-center gap-1">- {format(new Date(member.deathDate), "yyyy")}</span>
              )}
            </div>

            {member.birthPlace && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                <MapPin className="w-3 h-3" /> {member.birthPlace}
              </div>
            )}

            {member.linkedUserId && (
              <div className="mt-4 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                App User
              </div>
            )}

            {member.bio && (
              <p className="mt-4 text-sm text-foreground/80 leading-relaxed text-left w-full border-t border-border pt-4">
                {member.bio}
              </p>
            )}

            {user?.memberId && user.memberId !== memberId && (
              <div className="w-full mt-6 pt-4 border-t border-border">
                {relResult ? (
                  <div className="text-primary font-medium">{relResult}</div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={doCalculate}>
                    Calculate Relationship to Me
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Col - Feed & Media */}
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Timeline
            </h2>
            {posts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card/30 rounded-xl border border-dashed border-border">
                No memories tagged with {member.firstName} yet.
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post: any) => (
                  <div key={post.id} className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm">{post.content}</p>
                    <span className="text-xs text-muted-foreground block mt-2">{format(new Date(post.createdAt), "PPP")}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Media Gallery</h2>
            {gallery.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card/30 rounded-xl border border-dashed border-border">
                No media tagged with {member.firstName} yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {gallery.map((item: any) => (
                  <div key={item.id} className="aspect-square rounded-xl overflow-hidden bg-muted relative group">
                    {item.type === "image" ? (
                      <img src={item.url} alt="Gallery" className="w-full h-full object-cover" />
                    ) : item.type === "video" ? (
                      <video src={item.url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 p-2">
                        <AudioPlayer url={item.url} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={editData.bio || ""} onChange={e => setEditData({ ...editData, bio: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birth Date</Label>
                <Input type="date" value={editData.birthDate || ""} onChange={e => setEditData({ ...editData, birthDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Death Date</Label>
                <Input type="date" value={editData.deathDate || ""} onChange={e => setEditData({ ...editData, deathDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Birth Place</Label>
              <Input value={editData.birthPlace || ""} onChange={e => setEditData({ ...editData, birthPlace: e.target.value })} />
            </div>
            <Button className="w-full" onClick={onSaveEdit} disabled={updateMember.isPending}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
