import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetFamilyFeed,
  getGetFamilyFeedQueryKey,
  useCreatePost,
  useReactToPost,
  useDeletePost,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  useGetFamilyStats,
  getGetFamilyStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, ThumbsUp, PartyPopper, MessageCircle, Trash2, Lock, Plus, X, Image as ImageIcon } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useGetUploadSignature } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";

function Avatar({ name, url, size = "md" }: { name?: string; url?: string | null; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (url) return <img src={url} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  const initials = (name ?? "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`${sz} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

function PostComments({ familyId, postId }: { familyId: string; postId: string }) {
  const [text, setText] = useState("");
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
    <div className="mt-3 pt-3 border-t border-border/50">
      {isLoading ? (
        <div className="text-xs text-muted-foreground py-2">Loading comments...</div>
      ) : (
        <div className="space-y-2 mb-3">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex gap-2 items-start" data-testid={`comment-${c.id}`}>
              <Avatar name={c.authorName} url={c.authorAvatar} size="sm" />
              <div className="flex-1 bg-background/60 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{c.authorName}</span>
                <span className="text-muted-foreground ml-2 text-xs">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                <p className="mt-0.5 text-foreground/90">{c.content}</p>
              </div>
            </div>
          ))}
          {(comments ?? []).length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write a comment..."
          className="min-h-[40px] text-sm resize-none bg-background/60"
          rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          data-testid="input-comment"
        />
        <Button size="sm" onClick={submit} disabled={createComment.isPending} data-testid="button-submit-comment">
          Send
        </Button>
      </div>
    </div>
  );
}

function PostCard({ post, familyId, canDelete }: { post: any; familyId: string; canDelete: boolean }) {
  const [showComments, setShowComments] = useState(false);
  const reactToPost = useReactToPost();
  const deletePost = useDeletePost();
  const qc = useQueryClient();
  const { toast } = useToast();

  const react = (type: string) => {
    reactToPost.mutate({ familyId, postId: post.id, data: { type: type as any } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) })
    });
  };

  const remove = () => {
    deletePost.mutate({ familyId, postId: post.id }, {
      onSuccess: () => {
        toast({ title: "Post deleted" });
        qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) });
      }
    });
  };

  return (
    <div className="bg-card/60 border border-border/60 rounded-xl p-5 backdrop-blur-sm" data-testid={`post-card-${post.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.authorName} url={post.authorAvatar} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{post.authorName}</span>
              {post.isCapsule && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" />
                  {post.isLocked ? `Unlocks ${format(new Date(post.unlockAt), "MMM d, yyyy")}` : "Time Capsule"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
          </div>
        </div>
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={remove} data-testid={`button-delete-post-${post.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

      {post.mediaUrls?.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {post.mediaUrls.map((url: string, i: number) => (
            <img key={i} src={url} alt="Attached" className="w-full rounded-lg object-cover aspect-video" />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-1">
        {([
          { type: "like", icon: ThumbsUp, count: post.reactions?.like ?? 0, label: "Like" },
          { type: "love", icon: Heart, count: post.reactions?.love ?? 0, label: "Love" },
          { type: "celebrate", icon: PartyPopper, count: post.reactions?.celebrate ?? 0, label: "Celebrate" },
        ] as const).map(({ type, icon: Icon, count, label }) => (
          <Button key={type} variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => react(type)} data-testid={`button-react-${type}-${post.id}`}>
            <Icon className="w-3.5 h-3.5" />
            {count > 0 && <span>{count}</span>}
            <span className="sr-only">{label}</span>
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={() => setShowComments(v => !v)} data-testid={`button-toggle-comments-${post.id}`}>
          <MessageCircle className="w-3.5 h-3.5" />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
          Comments
        </Button>
      </div>

      {showComments && <PostComments familyId={familyId} postId={post.id} />}
    </div>
  );
}

function ComposePanel({ familyId, userId, onClose }: { familyId: string; userId: string; onClose: () => void }) {
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      getSignature.mutate({ data: { familyId } }, {
        onSuccess: async (sig) => {
          const result = await uploadToCloudinary(file, sig);
          setMediaUrls(prev => [...prev, result.secure_url]);
          setUploading(false);
        },
        onError: () => {
          toast({ title: "Upload failed", variant: "destructive" });
          setUploading(false);
        }
      });
    } catch {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!content.trim()) return;
    createPost.mutate({
      familyId,
      data: {
        content,
        mediaUrls,
        isCapsule,
        unlockAt: isCapsule ? unlockAt : undefined,
        taggedMembers: [],
      }
    }, {
      onSuccess: () => {
        toast({ title: "Post shared" });
        qc.invalidateQueries({ queryKey: getGetFamilyFeedQueryKey(familyId) });
        onClose();
      },
      onError: () => toast({ title: "Could not post", variant: "destructive" })
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Share a memory</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What would you like to share with the family?"
        className="min-h-[120px] resize-none bg-background/60 mb-3"
        data-testid="input-post-content"
      />
      {mediaUrls.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {mediaUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="media" className="h-16 rounded-lg object-cover" />
              <Button variant="ghost" size="icon" className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full" onClick={() => setMediaUrls(p => p.filter((_, j) => j !== i))}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mb-4">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-attach-media">
          <ImageIcon className="w-4 h-4 mr-1.5" />
          {uploading ? "Uploading..." : "Add photo"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={isCapsule} onChange={e => setIsCapsule(e.target.checked)} className="rounded" data-testid="checkbox-capsule" />
          Time capsule
        </label>
        {isCapsule && (
          <input
            type="datetime-local"
            value={unlockAt}
            onChange={e => setUnlockAt(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            data-testid="input-capsule-unlock"
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={createPost.isPending || !content.trim()} data-testid="button-submit-post">
          {createPost.isPending ? "Sharing..." : "Share"}
        </Button>
      </div>
    </div>
  );
}

export default function Feed() {
  const { familyId, user } = useAuth();
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

  const posts = (feed as any)?.posts ?? [];
  const birthdaysToday = stats?.birthdaysToday ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-sans text-foreground">Family Feed</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Recent memories from your family</p>
          </div>
          <Button onClick={() => setComposing(v => !v)} data-testid="button-compose-post">
            <Plus className="w-4 h-4 mr-1.5" />
            Share memory
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {birthdaysToday.length > 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <strong>Today's birthdays:</strong> {birthdaysToday.map((m: any) => `${m.firstName} ${m.lastName}`).join(", ")}
          </div>
        )}

        {composing && familyId && user && (
          <div className="mb-4">
            <ComposePanel familyId={familyId} userId={user.id} onClose={() => setComposing(false)} />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card/60 border border-border/60 rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-1">Be the first to share a memory with your family.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                familyId={familyId ?? ""}
                canDelete={post.authorId === user?.id || user?.role === "gatekeeper" || user?.role === "master_admin"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
