import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetFamilyFeed, getGetFamilyFeedQueryKey,
  useCreatePost, useReactToPost, useDeletePost,
  useListComments, getListCommentsQueryKey, useCreateComment,
  useGetFamilyStats, getGetFamilyStatsQueryKey,
  useListMembers, getListMembersQueryKey,
  useGetUploadSignature,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, ThumbsUp, PartyPopper, MessageCircle, Trash2, Lock, X, Image as ImageIcon, Plus, Send } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { format, formatDistanceToNow } from "date-fns";

function MemberAvatar({ name, url, className = "" }: { name?: string; url?: string | null; className?: string }) {
  const initials = (name ?? "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  if (url) return <img src={url} alt={name} className={`rounded-full object-cover flex-shrink-0 ${className}`} />;
  return (
    <div className={`rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm ${className}`}>
      {initials}
    </div>
  );
}

function PostComments({ familyId, postId }: { familyId: string; postId: string }) {
  const [text, setText] = useState("");
  const { user } = useAuth();
  const { data: comments, isLoading } = useListComments(familyId, postId, {
    query: { queryKey: getListCommentsQueryKey(familyId, postId) }
  });
  const createComment = useCreateComment();
  const qc = useQueryClient();
  const { toast } = useToast();

  const submit = () => {
    if (!text.trim()) return;
    createComment.mutate({ familyId, postId, data: { content: text } }, {
      onSuccess: () => {
        setText("");
        qc.invalidateQueries({ queryKey: getListCommentsQueryKey(familyId, postId) });
        qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) });
      },
      onError: () => toast({ title: "Could not post comment", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-3 px-4 pb-3 pt-1">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2.5">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex gap-2 items-start">
              <MemberAvatar name={c.authorName} url={c.authorAvatar} className="w-8 h-8" />
              <div className="flex-1 bg-muted/60 rounded-2xl px-3 py-2 text-sm">
                <span className="font-semibold text-foreground text-xs">{c.authorName}</span>
                <p className="mt-0.5 text-foreground/90 leading-snug">{c.content}</p>
              </div>
            </div>
          ))}
          {(comments ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet — be the first!</p>
          )}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <MemberAvatar name={user?.displayName} url={user?.avatarUrl} className="w-8 h-8" />
        <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2 border border-border/40">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          />
          <button onClick={submit} disabled={!text.trim() || createComment.isPending} className="text-primary disabled:opacity-30 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, familyId }: { post: any; familyId: string }) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const reactToPost = useReactToPost();
  const deletePost = useDeletePost();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canDelete = post.authorId === user?.id || user?.role === "gatekeeper" || user?.role === "master_admin";

  const react = (type: string) => {
    reactToPost.mutate({ familyId, postId: post.id, data: { type: type as any } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) })
    });
  };

  const remove = () => {
    if (!confirm("Delete this post?")) return;
    deletePost.mutate({ familyId, postId: post.id }, {
      onSuccess: () => {
        toast({ title: "Post removed" });
        qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) });
      }
    });
  };

  const reactions = [
    { type: "like", emoji: "👍", label: "Like", count: post.reactions?.like ?? 0 },
    { type: "love", emoji: "❤️", label: "Love", count: post.reactions?.love ?? 0 },
    { type: "celebrate", emoji: "🎉", label: "Celebrate", count: post.reactions?.celebrate ?? 0 },
  ];
  const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <MemberAvatar name={post.authorName} url={post.authorAvatar} className="w-10 h-10" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{post.authorName}</span>
              {post.isCapsule && (
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${post.isLocked ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"}`}>
                  <Lock className="w-2.5 h-2.5" />
                  {post.isLocked ? `Opens ${format(new Date(post.unlockAt), "MMM d, yyyy")}` : "Time Capsule Opened"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
          </div>
        </div>
        {canDelete && (
          <button onClick={remove} className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {post.mediaUrls?.length > 0 && (
        <div className={post.mediaUrls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
          {post.mediaUrls.map((url: string, i: number) => (
            <img key={i} src={url} alt="Attached" className="w-full object-cover max-h-96" />
          ))}
        </div>
      )}

      {totalReactions > 0 && (
        <div className="px-4 py-2 flex items-center gap-1 text-xs text-muted-foreground border-b border-border/30">
          <span className="flex gap-0.5">
            {reactions.filter(r => r.count > 0).map(r => <span key={r.type}>{r.emoji}</span>)}
          </span>
          <span className="ml-1">{totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}</span>
          {post.commentCount > 0 && (
            <button onClick={() => setShowComments(v => !v)} className="ml-auto hover:underline">
              {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center border-t border-border/30">
        {reactions.map(({ type, emoji, label, count }) => (
          <button
            key={type}
            onClick={() => react(type)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors hover:bg-muted/60 ${count > 0 ? "text-primary" : "text-muted-foreground"}`}
          >
            <span className="text-base leading-none">{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowComments(v => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors hover:bg-muted/60 ${showComments ? "text-primary" : "text-muted-foreground"}`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Comment</span>
        </button>
      </div>

      {showComments && <PostComments familyId={familyId} postId={post.id} />}
    </div>
  );
}

function ComposeDialog({ familyId, open, onClose }: { familyId: string; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isCapsule, setIsCapsule] = useState(false);
  const [unlockAt, setUnlockAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const createPost = useCreatePost();
  const getSignature = useGetUploadSignature();
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleClose = () => {
    setContent(""); setMediaUrls([]); setIsCapsule(false); setUnlockAt("");
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      getSignature.mutate({ data: { familyId } }, {
        onSuccess: async (sig) => {
          try {
            const result = await uploadToCloudinary(file, sig);
            setMediaUrls(prev => [...prev, result.secure_url]);
          } catch {
            toast({ title: "Upload failed", description: "Check that Cloudinary is set up in your Render environment variables.", variant: "destructive" });
          }
          setUploading(false);
        },
        onError: () => {
          toast({ title: "Upload failed", description: "Could not get upload permission from the server.", variant: "destructive" });
          setUploading(false);
        }
      });
    } catch {
      setUploading(false);
    }
    if (e.target) e.target.value = "";
  };

  const submit = () => {
    if (!content.trim()) return;
    createPost.mutate({
      familyId,
      data: { content, mediaUrls, isCapsule, unlockAt: isCapsule ? unlockAt : undefined, taggedMembers: [] }
    }, {
      onSuccess: () => {
        toast({ title: "Memory shared with the family!" });
        qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) });
        handleClose();
      },
      onError: () => toast({ title: "Could not post", variant: "destructive" })
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center font-semibold">Share a Memory</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 py-2 border-b border-border/40">
          <MemberAvatar name={user?.displayName} url={user?.avatarUrl} className="w-10 h-10" />
          <div>
            <p className="font-semibold text-sm">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground">Sharing with the whole family</p>
          </div>
        </div>

        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={`What's on your mind, ${user?.displayName?.split(" ")[0] ?? "friend"}?`}
          className="min-h-[130px] resize-none border-0 rounded-none px-0 text-base focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/60"
          autoFocus
        />

        {(mediaUrls.length > 0 || uploading) && (
          <div className="flex gap-2 flex-wrap">
            {mediaUrls.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt="preview" className="h-20 w-20 rounded-xl object-cover" />
                <button onClick={() => setMediaUrls(p => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="h-20 w-20 rounded-xl bg-muted animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Uploading…</span>
              </div>
            )}
          </div>
        )}

        <div className="border border-border/40 rounded-xl p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Add to your post</p>
          <div className="flex items-center gap-1 flex-wrap">
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
              <ImageIcon className="w-4 h-4" /> Photo/Video
            </button>
            <label className={`flex items-center gap-1.5 text-sm cursor-pointer px-3 py-1.5 rounded-lg transition-colors font-medium ${isCapsule ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}>
              <Lock className="w-4 h-4" />
              Time Capsule
              <input type="checkbox" checked={isCapsule} onChange={e => setIsCapsule(e.target.checked)} className="hidden" />
            </label>
          </div>
          {isCapsule && (
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs text-muted-foreground">Unlock on:</p>
              <input type="datetime-local" value={unlockAt} onChange={e => setUnlockAt(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background flex-1" />
            </div>
          )}
        </div>

        <Button onClick={submit} disabled={createPost.isPending || !content.trim()} className="w-full rounded-xl font-semibold h-11">
          {createPost.isPending ? "Sharing…" : "Share with Family"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Feed() {
  const { familyId, user } = useAuth();
  const [, navigate] = useLocation();
  const [composing, setComposing] = useState(false);

  const { data: feed, isLoading } = useGetFamilyFeed(
    familyId ?? "",
    {},
    { query: { enabled: !!familyId, queryKey: getGetFamilyFeedQueryKey(familyId ?? "") } }
  );
  const { data: stats } = useGetFamilyStats(
    familyId ?? "",
    { query: { enabled: !!familyId, queryKey: getGetFamilyStatsQueryKey(familyId ?? "") } }
  );
  const { data: members = [] } = useListMembers(
    familyId ?? "",
    { query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") } }
  );

  const posts = (feed as any)?.posts ?? [];
  const birthdaysToday: any[] = stats?.birthdaysToday ?? [];

  if (!familyId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-6xl">🏡</div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Sanctuary</h2>
          <p className="text-muted-foreground max-w-sm">You're not part of a family group yet. Ask a Gatekeeper to send you an invite link, or create your own family from the System Cockpit.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {birthdaysToday.length > 0 && (
          <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-amber-400/20 to-orange-400/20 border border-amber-300/50 dark:border-amber-700/40 rounded-2xl flex items-center gap-3">
            <span className="text-3xl leading-none">🎂</span>
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Happy Birthday!</p>
              <p className="text-amber-700 dark:text-amber-400 text-sm">
                {birthdaysToday.map((m: any) => `${m.firstName} ${m.lastName}`).join(", ")} {birthdaysToday.length === 1 ? "is" : "are"} celebrating today 🎉
              </p>
            </div>
          </div>
        )}

        {(members as any[]).length > 0 && (
          <div className="px-4 pt-4">
            <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <div className="flex gap-4 pb-1 w-max">
                <button onClick={() => setComposing(true)} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/40 bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Plus className="w-6 h-6 text-primary/60" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Add</span>
                </button>
                {(members as any[]).slice(0, 15).map((m: any) => (
                  <button key={m.id} onClick={() => navigate(`/profile/${m.id}`)} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
                    <div className="w-16 h-16 rounded-full ring-2 ring-primary/50 ring-offset-2 ring-offset-background overflow-hidden group-hover:ring-primary transition-all">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {m.firstName?.[0]}{m.lastName?.[0]}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[64px] font-medium">{m.firstName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pt-4 pb-2">
          <div onClick={() => setComposing(true)} className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors shadow-sm group">
            <MemberAvatar name={user?.displayName} url={user?.avatarUrl} className="w-10 h-10" />
            <div className="flex-1 bg-muted/40 rounded-full px-4 py-2.5 text-sm text-muted-foreground border border-border/40 group-hover:bg-muted/60 transition-colors">
              What's on your mind, {user?.displayName?.split(" ")[0]}?
            </div>
            <ImageIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
          </div>
        </div>

        <div className="px-4 pb-6 space-y-4">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border/60 rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-32 bg-muted rounded-full" />
                    <div className="h-2 w-20 bg-muted rounded-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded-full" />
                  <div className="h-3 w-4/5 bg-muted rounded-full" />
                </div>
              </div>
            ))
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-card/30 border border-dashed border-border rounded-2xl">
              <div className="text-5xl mb-4">🏡</div>
              <h3 className="font-bold text-foreground mb-1">Your family feed is empty</h3>
              <p className="text-sm text-muted-foreground mb-5">Be the first to share a memory, photo, or story with the family.</p>
              <Button onClick={() => setComposing(true)} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Share the first memory
              </Button>
            </div>
          ) : (
            posts.map((post: any) => (
              <PostCard key={post.id} post={post} familyId={familyId} />
            ))
          )}
        </div>
      </div>

      <ComposeDialog familyId={familyId} open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
