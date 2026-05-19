import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useGetPendingMembers, getGetPendingMembersQueryKey,
  useApproveMember, useRejectMember,
  useUpdateMemberRole, useGenerateInvite,
  useGetFamilyStats, getGetFamilyStatsQueryKey,
  useGenerateChronicle, useListMembers, getListMembersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Shield, Check, X, Users, Image as ImageIcon, MessageSquare, Heart, Link as LinkIcon, Download } from "lucide-react";
import QRCode from "qrcode.react";

export default function Gatekeeper() {
  const { familyId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("168"); // 7 days in hours
  const [generatedInvite, setGeneratedInvite] = useState("");

  const { data: stats } = useGetFamilyStats(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getGetFamilyStatsQueryKey(familyId ?? "") }
  });

  const { data: pending = [] } = useGetPendingMembers(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getGetPendingMembersQueryKey(familyId ?? "") }
  });

  const { data: members = [] } = useListMembers(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") }
  });

  const approve = useApproveMember();
  const reject = useRejectMember();
  const updateRole = useUpdateMemberRole();
  const genInvite = useGenerateInvite();
  const genChronicle = useGenerateChronicle();

  const handleApprove = (userId: string) => {
    approve.mutate({ familyId: familyId!, userId }, {
      onSuccess: () => {
        toast({ title: "Member approved" });
        qc.invalidateQueries({ queryKey: getGetPendingMembersQueryKey(familyId ?? "") });
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId ?? "") });
      }
    });
  };

  const handleReject = (userId: string) => {
    reject.mutate({ familyId: familyId!, userId }, {
      onSuccess: () => {
        toast({ title: "Member rejected" });
        qc.invalidateQueries({ queryKey: getGetPendingMembersQueryKey(familyId ?? "") });
      }
    });
  };

  const handleRoleChange = (memberId: string, role: any) => {
    updateRole.mutate({ familyId: familyId!, memberId, data: { role } }, {
      onSuccess: () => {
        toast({ title: "Role updated" });
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId ?? "") });
      }
    });
  };

  const handleGenerateInvite = () => {
    genInvite.mutate({
      familyId: familyId!,
      data: { email: inviteEmail || undefined, expiresInH: parseInt(inviteExpiry) }
    }, {
      onSuccess: (data: any) => {
        const url = `${window.location.origin}/register?token=${data.token}`;
        setGeneratedInvite(url);
        toast({ title: "Invite generated" });
      }
    });
  };

  const handleGenerateChronicle = () => {
    toast({ title: "Generating chronicle…", description: "Your family story is being written by AI. Please wait." });
    genChronicle.mutate({ familyId: familyId! }, {
      onSuccess: (data: any) => {
        if (data?.html) {
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(data.html);
            win.document.close();
            toast({ title: "Chronicle ready!", description: "Your family chronicle opened in a new tab." });
          } else {
            toast({ title: "Chronicle ready!", description: "Allow pop-ups to view the chronicle.", variant: "destructive" });
          }
        } else {
          toast({ title: "Chronicle started", description: "You will be notified when it is ready." });
        }
      },
      onError: () => toast({ title: "Chronicle failed", description: "Could not generate the chronicle.", variant: "destructive" })
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Gatekeeper Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage family access, roles, and settings.</p>
        </div>
        <Button onClick={handleGenerateChronicle} variant="outline" className="gap-2" disabled={genChronicle.isPending}>
          <Download className={`w-4 h-4 ${genChronicle.isPending ? "animate-bounce" : ""}`} />
          {genChronicle.isPending ? "Writing chronicle…" : "AI Chronicle"}
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: stats?.totalMembers || 0, icon: Users },
          { label: "Living Members", value: stats?.livingMembers || 0, icon: Heart },
          { label: "Total Posts", value: stats?.totalPosts || 0, icon: MessageSquare },
          { label: "Media Items", value: stats?.totalMedia || 0, icon: ImageIcon },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border p-4 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold leading-none mb-1">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid grid-cols-3 mb-6 bg-card border border-border p-1 rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Pending Approvals
            {pending.length > 0 && <span className="ml-2 bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-full">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Member Roles</TabsTrigger>
          <TabsTrigger value="invites" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Invite Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {pending.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Shield className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">All caught up</p>
                <p className="text-sm">No pending member requests.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {pending.map((p: any) => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                        {p.firstName[0]}{p.lastName[0]}
                      </Avatar>
                      <div>
                        <div className="font-semibold">{p.firstName} {p.lastName}</div>
                        <div className="text-sm text-muted-foreground">{p.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleReject(p.id)}>
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(p.id)}>
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/50">
            {members.map((m: any) => (
              <div key={m.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                    {m.avatarUrl ? <img src={m.avatarUrl} alt={m.firstName} className="w-full h-full object-cover rounded-full"/> : `${m.firstName[0]}${m.lastName[0]}`}
                  </Avatar>
                  <div>
                    <div className="font-semibold">{m.firstName} {m.lastName}</div>
                    <div className="text-sm text-muted-foreground capitalize">{m.role}</div>
                  </div>
                </div>
                <Select value={m.role} onValueChange={(val) => handleRoleChange(m.id, val)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="gatekeeper">Gatekeeper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="invites">
          <div className="bg-card border border-border rounded-xl p-6 max-w-xl">
            <h3 className="text-lg font-semibold mb-4">Generate Invitation Link</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email (Optional)</Label>
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Limit token to specific email" />
              </div>
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Select value={inviteExpiry} onValueChange={setInviteExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 Hours</SelectItem>
                    <SelectItem value="72">72 Hours</SelectItem>
                    <SelectItem value="168">7 Days</SelectItem>
                    <SelectItem value="720">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateInvite} className="w-full" disabled={genInvite.isPending}>
                Generate Invite Link
              </Button>

              {generatedInvite && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">Invite URL</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={generatedInvite} className="bg-background font-mono text-xs" />
                      <Button size="icon" variant="outline" onClick={() => {
                        navigator.clipboard.writeText(generatedInvite);
                        toast({ title: "Copied to clipboard" });
                      }}>
                        <LinkIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">QR Code</Label>
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-white rounded-xl border border-border shadow-sm">
                        <QRCode
                          id="invite-qr-canvas"
                          value={generatedInvite}
                          size={160}
                          level="M"
                          includeMargin={false}
                          renderAs="canvas"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-xs"
                        onClick={() => {
                          const canvas = document.getElementById("invite-qr-canvas") as HTMLCanvasElement;
                          if (!canvas) return;
                          const link = document.createElement("a");
                          link.download = "sanctuary-invite-qr.png";
                          link.href = canvas.toDataURL("image/png");
                          link.click();
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download QR
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}