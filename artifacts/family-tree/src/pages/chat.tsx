import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListMembers, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { rtdb } from "@/lib/firebase";
import { ref, push, onValue, off, serverTimestamp, set, remove } from "firebase/database";
import { useGetUploadSignature } from "@workspace/api-client-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Image as ImageIcon, Send, Search, Users, MessageSquare } from "lucide-react";
import { format } from "date-fns";

function ChatMessage({ msg, isOwn }: { msg: any; isOwn: boolean }) {
  return (
    <div className={`flex flex-col mb-4 max-w-[80%] ${isOwn ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && (
          <Avatar className="w-8 h-8 rounded-full flex-shrink-0 bg-primary/20 flex items-center justify-center text-primary text-xs font-medium">
            {msg.senderAvatar ? (
              <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover rounded-full" />
            ) : (
              (msg.senderName || "?").substring(0, 2).toUpperCase()
            )}
          </Avatar>
        )}
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          {!isOwn && <span className="text-xs text-muted-foreground ml-1 mb-1">{msg.senderName}</span>}
          <div className={`px-4 py-2 rounded-2xl ${isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
            {msg.mediaUrl && (
              <img src={msg.mediaUrl} alt="attachment" className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" />
            )}
            {msg.text && <p className="whitespace-pre-wrap break-words text-sm">{msg.text}</p>}
          </div>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground px-10">
        {msg.timestamp ? format(new Date(msg.timestamp), 'h:mm a') : 'Sending...'}
      </span>
    </div>
  );
}

export default function Chat() {
  const { user, familyId } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const getSignature = useGetUploadSignature();

  const { data: members = [] } = useListMembers(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") }
  });

  const getChatId = (otherUserId: string) => {
    return [user?.id, otherUserId].sort().join("_");
  };

  useEffect(() => {
    if (!activeChatId || !rtdb) return;

    const messagesRef = ref(rtdb, `/chats/${activeChatId}/messages`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMessages(Object.entries(data).map(([key, val]: any) => ({ id: key, ...val })));
      } else {
        setMessages([]);
      }
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });

    const typingRef = ref(rtdb, `/chats/${activeChatId}/typing`);
    onValue(typingRef, (snapshot) => {
      const data = snapshot.val() || {};
      setTyping(data);
    });

    return () => {
      off(messagesRef);
      off(typingRef);
    };
  }, [activeChatId]);

  const handleTyping = (isTyping: boolean) => {
    if (!activeChatId || !user || !rtdb) return;
    const userTypingRef = ref(rtdb, `/chats/${activeChatId}/typing/${user.id}`);
    if (isTyping) {
      set(userTypingRef, true);
    } else {
      remove(userTypingRef);
    }
  };

  const sendMessage = async (mediaUrl?: string) => {
    if ((!text.trim() && !mediaUrl) || !activeChatId || !user || !rtdb) return;

    const msg = {
      senderId: user.id,
      senderName: user.displayName,
      senderAvatar: user.avatarUrl || null,
      text: text.trim(),
      mediaUrl: mediaUrl || null,
      timestamp: serverTimestamp()
    };

    setText("");
    handleTyping(false);
    
    try {
      const newMsgRef = push(ref(rtdb, `/chats/${activeChatId}/messages`));
      await set(newMsgRef, msg);
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !familyId) return;
    
    setUploading(true);
    try {
      const sig = await getSignature.mutateAsync({ data: { familyId } });
      const result = await uploadToCloudinary(file, sig);
      await sendMessage(result.secure_url);
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const otherTypingNames = Object.keys(typing)
    .filter(id => id !== user?.id && typing[id])
    .map(id => members.find(m => m.id === id)?.firstName)
    .filter(Boolean);

  return (
    <div className="h-full flex bg-background/50">
      {/* Sidebar */}
      <div className="w-72 border-r border-border/50 flex flex-col bg-card/30">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Messages
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Family Square</div>
            <button
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${activeChatId === familyId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-foreground'}`}
              onClick={() => setActiveChatId(familyId)}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm">Family Chat</div>
                <div className="text-xs text-muted-foreground truncate">Global discussion</div>
              </div>
            </button>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Direct Messages</div>
            <div className="space-y-1">
              {members.filter(m => m.id !== user?.id).map(m => {
                const chatId = getChatId(m.id);
                const isActive = activeChatId === chatId;
                return (
                  <button
                    key={m.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-foreground'}`}
                    onClick={() => setActiveChatId(chatId)}
                  >
                    <Avatar className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.firstName} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        `${m.firstName[0]}${m.lastName[0]}`
                      )}
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="text-sm">{m.firstName} {m.lastName}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background/50">
        {activeChatId ? (
          <>
            <div className="h-16 border-b border-border/50 flex items-center px-6 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
              <h3 className="font-semibold text-lg">
                {activeChatId === familyId ? "Family Square" : members.find(m => getChatId(m.id) === activeChatId)?.firstName + " " + members.find(m => getChatId(m.id) === activeChatId)?.lastName}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
              <div className="flex flex-col justify-end min-h-full">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground my-auto flex flex-col items-center">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                    <p>No messages yet.</p>
                    <p className="text-sm opacity-70">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <ChatMessage key={msg.id} msg={msg} isOwn={msg.senderId === user?.id} />
                  ))
                )}
                {otherTypingNames.length > 0 && (
                  <div className="text-xs text-muted-foreground italic mt-2 ml-12 animate-pulse">
                    {otherTypingNames.join(", ")} {otherTypingNames.length > 1 ? 'are' : 'is'} typing...
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-card/30 border-t border-border/50">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <ImageIcon className="w-5 h-5" />
                </Button>
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    handleTyping(e.target.value.length > 0);
                  }}
                  onBlur={() => handleTyping(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-[120px] resize-none py-3"
                  rows={1}
                />
                <Button onClick={() => sendMessage()} disabled={(!text.trim() && !uploading) || uploading} className="h-10 w-10 shrink-0 p-0" size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No chat selected</p>
            <p className="text-sm opacity-70">Choose a conversation from the sidebar</p>
          </div>
        )}
      </div>
    </div>
  );
}