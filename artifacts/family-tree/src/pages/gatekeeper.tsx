import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useGetPendingMembers, getGetPendingMembersQueryKey,
  useApproveMember, useRejectMember,
  useUpdateMemberRole, useGenerateInvite,
  useGetFamilyStats, getGetFamilyStatsQueryKey,
  useGenerateChronicle, useListMembers, getListMembersQueryKey,
  useCreateMember,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Check, X, Users, Image as ImageIcon, MessageSquare, Heart, Link as LinkIcon, Download, UserPlus, Calendar } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";

export default function Gatekeeper() {
  const { familyId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("168");
  const [generatedInvite, setGeneratedInvite] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    firstName: "", lastName: "", gender: "unknown",
    birthDate: "", deathDate: "", birthPlace: "", bio: "", avatarUrl: "",
  });

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
  const createMember = useCreateMember();

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
    toast({ title: "Generating chronicle…", description: "Your family story is being written by AI. Please wait up to 30 seconds." });
    genChronicle.mutate({ familyId: familyId! }, {
      onSuccess: (data: any) => {
        if (data?.html) {
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(data.html);
            win.document.close();
            toast({ title: "Chronicle ready!", description: "Your family chronicle opened in a new tab." });
          } else {
            toast({ title: "Chronicle ready!", description: "Allow pop-ups in your browser to view the chronicle.", variant: "destructive" });
          }
        } else {
          toast({ title: "Chronicle started", description: "You will be notified when it is ready." });
        }
      },
      onError: (err: any) => {
        const message = err?.message?.includes("OPENAI") || err?.message?.includes("API")
          ? "OpenAI API key is not configured in the server environment."
          : "Could not generate the chronicle.";
        toast({ title: "Chronicle failed", description: message, variant: "destructive" });
      }
    });
  };

  const handleAddMember = () => {
    if (!newMember.firstName || !newMember.lastName) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    createMember.mutate({
      familyId: familyId!,
      data: {
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        gender: newMember.gender as any,
        birthDate: newMember.birthDate || undefined,
        deathDate: newMember.deathDate || undefined,
        birthPlace: newMember.birthPlace || undefined,
        bio: newMember.bio || undefined,
        avatarUrl: newMember.avatarUrl || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: `${newMember.firstName} ${newMember.lastName} added to the family tree` });
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId ?? "") });
        qc.invalidateQueries({ queryKey: getGetFamilyStatsQueryKey(familyId ?? "") });
        setNewMember({ firstName: "", lastName: "", gender: "unknown", birthDate: "", deathDate: "", birthPlace: "", bio: "", avatarUrl: "" });
        setAddMemberOpen(false);
      },
      onError: (err: any) => toast({ title: "Failed to add member", description: err?.message, variant: "destructive" })
    });
  };

  const getPendingMembersQueryKey = () => getGetPendingMembersQueryKey(familyId ?? "");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Gatekeeper Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage family access, members, and settings.</p>
        </div>
        <Button onClick={handleGenerateChronicle} variant="outline" className="gap-2" disabled={genChronicle.isPending}>
          <Download className={`w-4 h-4 ${genChronicle.isPending ? "animate-bounce" : ""}`} />
          {genChronicle.isPending ? "Writing…" : "AI Family Chronicle"}
        </Button>
      </div>

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
        <TabsList className="grid grid-cols-4 mb-6 bg-card border border-border p-1 rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Approvals
            {(pending as any[]).length > 0 && <span className="ml-2 bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-full">{(pending as any[]).length}</span>}
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Members
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Roles</TabsTrigger>
          <TabsTrigger value="invites" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Invite</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {(pending as any[]).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Shield className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">All caught up</p>
                <p className="text-sm">No pending member requests.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {(pending as any[]).map((p: any) => (
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

        <TabsContent value="members">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{(members as any[]).length} members in the family tree</p>
            <Button size="sm" onClick={() => setAddMemberOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add Member
            </Button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {(members as any[]).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Users className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">No members yet</p>
                <p className="text-sm mb-4">Start building your family tree by adding the first member.</p>
                <Button size="sm" onClick={() => setAddMemberOpen(true)} className="gap-2">
                  <UserPlus className="w-4 h-4" /> Add First Member
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {(members as any[]).map((m: any) => (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary overflow-hidden flex-shrink-0">
                        {m.avatarUrl
                          ? <img src={m.avatarUrl} alt={m.firstName} className="w-full h-full object-cover" />
                          : `${m.firstName?.[0] ?? ""}${m.lastName?.[0] ?? ""}`
                        }
                      </div>
                      <div>
                        <div className="font-semibold">{m.firstName} {m.lastName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {m.birthDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(m.birthDate), "yyyy")}
                              {m.deathDate && ` – ${format(new Date(m.deathDate), "yyyy")}`}
                            </span>
                          )}
                          {m.birthPlace && <span>· {m.birthPlace}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.linkedUserId && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">App User</span>
                      )}
                      {m.gender && m.gender !== "unknown" && (
                        <span className="text-xs text-muted-foreground capitalize">{m.gender}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/50">
            {(members as any[]).map((m: any) => (
              <div key={m.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary overflow-hidden">
                    {m.avatarUrl ? <img src={m.avatarUrl} alt={m.firstName} className="w-full h-full object-cover rounded-full"/> : `${m.firstName[0]}${m.lastName[0]}`}
                  </Avatar>
                  <div>
                    <div className="font-semibold">{m.firstName} {m.lastName}</div>
                    <div className="text-sm text-muted-foreground capitalize">{m.role ?? "user"}</div>
                  </div>
                </div>
                <Select value={m.role ?? "user"} onValueChange={(val) => handleRoleChange(m.id, val)}>
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
            <h3 className="text-lg font-semibold mb-1">Generate Invitation Link</h3>
            <p className="text-sm text-muted-foreground mb-4">Share this link with a family member so they can register and join your family group.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email (optional — limits the token to one address)</Label>
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="family.member@email.com" />
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
                      <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedInvite); toast({ title: "Copied to clipboard" }); }}>
                        <LinkIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">QR Code</Label>
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-white rounded-xl border border-border shadow-sm">
                        <QRCodeCanvas id="invite-qr-canvas" value={generatedInvite} size={160} level="M" includeMargin={false} />
                      </div>
                      <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => {
                        const canvas = document.getElementById("invite-qr-canvas") as HTMLCanvasElement;
                        if (!canvas) return;
                        const link = document.createElement("a");
                        link.download = "sanctuary-invite-qr.png";
                        link.href = canvas.toDataURL("image/png");
                        link.click();
                      }}>
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

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={newMember.firstName} onChange={e => setNewMember(p => ({ ...p, firstName: e.target.value }))} placeholder="e.g. Margaret" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input value={newMember.lastName} onChange={e => setNewMember(p => ({ ...p, lastName: e.target.value }))} placeholder="e.g. Johnson" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={newMember.gender} onValueChange={v => setNewMember(p => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown / prefer not to say</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input type="date" value={newMember.birthDate} onChange={e => setNewMember(p => ({ ...p, birthDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Passing</Label>
                <Input type="date" value={newMember.deathDate} onChange={e => setNewMember(p => ({ ...p, deathDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Birthplace</Label>
              <Input value={newMember.birthPlace} onChange={e => setNewMember(p => ({ ...p, birthPlace: e.target.value }))} placeholder="e.g. Lagos, Nigeria" />
            </div>
            <div className="space-y-1.5">
              <Label>Short Bio</Label>
              <Textarea value={newMember.bio} onChange={e => setNewMember(p => ({ ...p, bio: e.target.value }))} placeholder="A sentence or two about this person..." rows={2} className="resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label>Photo URL (optional)</Label>
              <Input value={newMember.avatarUrl} onChange={e => setNewMember(p => ({ ...p, avatarUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddMember} disabled={createMember.isPending || !newMember.firstName || !newMember.lastName}>
                {createMember.isPending ? "Adding…" : "Add to Family Tree"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
