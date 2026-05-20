import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateMember, useCreateRelationship, useGetUploadSignature } from "@workspace/api-client-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { Member } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { X, UserPlus, Link as LinkIcon } from "lucide-react";

const memberSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  birthPlace: z.string().optional(),
  bio: z.string().optional(),
});

type MemberForm = z.infer<typeof memberSchema>;

interface Props {
  forMember: Member | null;
  relationshipType: "parent" | "child" | "spouse";
  familyId: string;
  existingMembers: Member[];
  onClose: () => void;
  onSuccess: () => void;
}

const relTypeLabels: Record<string, { title: string; fromLabel: string; toLabel: string }> = {
  parent: {
    title: "Add Parent",
    fromLabel: "parent",
    toLabel: "child",
  },
  child: {
    title: "Add Child",
    fromLabel: "parent",
    toLabel: "child",
  },
  spouse: {
    title: "Add Spouse / Partner",
    fromLabel: "person",
    toLabel: "spouse",
  },
};

export default function AddRelativeModal({
  forMember, relationshipType, familyId, existingMembers, onClose, onSuccess
}: Props) {
  const { toast } = useToast();
  const createMember = useCreateMember();
  const createRelationship = useCreateRelationship();
  const getSignature = useGetUploadSignature();

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const meta = relTypeLabels[relationshipType];

  const form = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      firstName: "", lastName: "", gender: "unknown",
      birthDate: "", deathDate: "", birthPlace: "", bio: "",
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const buildRelationshipArgs = (newMemberId: string) => {
    if (!forMember) {
      return null;
    }
    if (relationshipType === "parent") {
      return { fromMemberId: newMemberId, toMemberId: forMember.id, type: "parent" as const };
    }
    if (relationshipType === "child") {
      return { fromMemberId: forMember.id, toMemberId: newMemberId, type: "parent" as const };
    }
    return { fromMemberId: forMember.id, toMemberId: newMemberId, type: "spouse" as const };
  };

  const handleSubmit = async (values: MemberForm) => {
    setIsSubmitting(true);
    try {
      let memberId: string;

      if (mode === "existing") {
        if (!selectedExistingId) {
          toast({ title: "Please select a member", variant: "destructive" });
          return;
        }
        memberId = selectedExistingId;
      } else {
        let avatarUrl: string | undefined;
        if (avatarFile) {
          setUploading(true);
          const sig = await getSignature.mutateAsync({ data: { familyId } });
          const result = await uploadToCloudinary(avatarFile, sig);
          avatarUrl = result.secure_url;
          setUploading(false);
        }

        const payload: any = {
          firstName: values.firstName,
          lastName: values.lastName,
          gender: values.gender || "unknown",
          birthDate: values.birthDate || null,
          deathDate: values.deathDate || null,
          birthPlace: values.birthPlace || null,
          bio: values.bio || null,
          avatarUrl: avatarUrl ?? null,
        };

        const result = await createMember.mutateAsync({ familyId, data: payload });
        memberId = result.id;
      }

      if (forMember) {
        const relArgs = buildRelationshipArgs(memberId);
        if (relArgs) {
          await createRelationship.mutateAsync({
            familyId,
            data: relArgs as any,
          });
        }
      }

      toast({ title: mode === "new" ? "Member added to tree" : "Relationship linked" });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to add member", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExistingLink = async () => {
    if (!selectedExistingId || !forMember) return;
    setIsSubmitting(true);
    try {
      const relArgs = buildRelationshipArgs(selectedExistingId);
      if (relArgs) {
        await createRelationship.mutateAsync({ familyId, data: relArgs as any });
      }
      toast({ title: "Relationship linked" });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to link relationship", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableMembers = existingMembers.filter(m => m.id !== forMember?.id);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: "hsl(var(--card))" }}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {meta.title}
            {forMember && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                for {forMember.firstName} {forMember.lastName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {availableMembers.length > 0 && forMember && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "new" | "existing")}>
            <TabsList className="w-full">
              <TabsTrigger value="new" className="flex-1 gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                New Person
              </TabsTrigger>
              <TabsTrigger value="existing" className="flex-1 gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" />
                Existing Member
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {mode === "existing" && forMember ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Select existing member</label>
              <Select value={selectedExistingId} onValueChange={setSelectedExistingId}>
                <SelectTrigger className="bg-background/60">
                  <SelectValue placeholder="Choose a family member…" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                      {m.birthDate && ` (b. ${new Date(m.birthDate).getFullYear()})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleExistingLink}
              disabled={!selectedExistingId || isSubmitting}
            >
              {isSubmitting ? "Linking…" : "Link Relationship"}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
              {/* Avatar upload */}
              <div className="flex items-center gap-4">
                <label className="w-16 h-16 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors overflow-hidden flex-shrink-0 relative">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground text-center leading-tight px-1">Photo</span>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium">Optional photo</p>
                  <p>Click to upload a portrait</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9 text-sm bg-background/60 border-border/60" placeholder="First" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9 text-sm bg-background/60 border-border/60" placeholder="Last" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Gender</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 text-sm bg-background/60 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="unknown">Unknown / Other</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Birth Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="h-9 text-sm bg-background/60 border-border/60" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="deathDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Death Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="h-9 text-sm bg-background/60 border-border/60" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="birthPlace" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Birth Place</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-9 text-sm bg-background/60 border-border/60" placeholder="City, Country" />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Bio / Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="text-sm bg-background/60 border-border/60 min-h-16 resize-none" placeholder="A brief life story…" />
                  </FormControl>
                </FormItem>
              )} />

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  className="flex-1 glow-subtle"
                  disabled={isSubmitting || uploading}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Adding…
                    </span>
                  ) : (
                    `Add ${meta.title.replace("Add ", "")}`
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
