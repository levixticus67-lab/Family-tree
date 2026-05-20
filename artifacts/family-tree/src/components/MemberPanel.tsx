import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateMember, useGetUploadSignature } from "@workspace/api-client-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useQueryClient } from "@tanstack/react-query";
import { getListMembersQueryKey } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  X, Edit3, Trash2, UserPlus, Camera, ChevronUp, ChevronDown, Heart,
  MapPin, Calendar, User, FileText
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const editSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  birthPlace: z.string().optional(),
  bio: z.string().optional(),
});

interface Props {
  member: Member;
  familyId: string;
  members: Member[];
  onClose: () => void;
  onDelete: (m: Member) => void;
  onAddRelative: (type: "parent" | "child" | "spouse") => void;
  onUpdated: () => void;
}

export default function MemberPanel({
  member, familyId, onClose, onDelete, onAddRelative, onUpdated
}: Props) {
  const { isGatekeeper } = useAuth();
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const updateMember = useUpdateMember();
  const getSignature = useGetUploadSignature();

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: member.firstName,
      lastName: member.lastName,
      gender: member.gender ?? "unknown",
      birthDate: member.birthDate ?? "",
      deathDate: member.deathDate ?? "",
      birthPlace: member.birthPlace ?? "",
      bio: member.bio ?? "",
    },
  });

  const handleSave = (values: z.infer<typeof editSchema>) => {
    const payload: Record<string, any> = { ...values };
    if (!payload.birthDate) payload.birthDate = null;
    if (!payload.deathDate) payload.deathDate = null;
    if (!payload.birthPlace) payload.birthPlace = null;
    if (!payload.bio) payload.bio = null;

    updateMember.mutate({ familyId, memberId: member.id, data: payload as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId) });
        setIsEditing(false);
        onUpdated();
      }
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sig = await getSignature.mutateAsync({ data: { familyId } });
      const result = await uploadToCloudinary(file, sig);
      await updateMember.mutateAsync({
        familyId,
        memberId: member.id,
        data: { avatarUrl: result.secure_url } as any,
      });
      qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId) });
      onUpdated();
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const initials = `${(member.firstName ?? "")[0] ?? ""}${(member.lastName ?? "")[0] ?? ""}`.toUpperCase();
  const birthYear = member.birthDate ? new Date(member.birthDate).getFullYear() : null;
  const deathYear = member.deathDate ? new Date(member.deathDate).getFullYear() : null;
  const age = birthYear
    ? deathYear
      ? deathYear - birthYear
      : new Date().getFullYear() - birthYear
    : null;

  return (
    <div
      className="absolute right-0 top-0 h-full w-80 panel-enter z-20 flex flex-col border-l border-border/50 overflow-hidden"
      style={{ background: "hsl(var(--card))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
        <h3 className="font-semibold text-sm">Member Profile</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar & name */}
        <div className="px-4 pt-5 pb-4 text-center border-b border-border/40">
          <div className="relative inline-block mb-3">
            <div
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold overflow-hidden border-2"
              style={{
                borderColor: "hsl(var(--primary) / 0.4)",
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
              }}
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={initials} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {isGatekeeper && (
              <label
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-md hover:opacity-90 transition-opacity"
                title="Change photo"
              >
                <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            )}
          </div>
          <h2 className="font-semibold text-base">{member.firstName} {member.lastName}</h2>
          {birthYear && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {member.deathDate ? `${birthYear} – ${deathYear}` : `Born ${birthYear}`}
              {age !== null && ` · ${age} ${member.deathDate ? "years" : "yrs old"}`}
            </p>
          )}
          {uploading && <p className="text-xs text-primary mt-1 animate-pulse">Uploading…</p>}
        </div>

        {/* Details */}
        {!isEditing ? (
          <div className="px-4 py-4 space-y-3">
            {member.gender && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="capitalize">{member.gender}</span>
              </div>
            )}
            {member.birthDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{format(new Date(member.birthDate), "MMMM d, yyyy")}</span>
              </div>
            )}
            {member.deathDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Passed: {format(new Date(member.deathDate), "MMMM d, yyyy")}</span>
              </div>
            )}
            {member.birthPlace && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{member.birthPlace}</span>
              </div>
            )}
            {member.bio && (
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-muted-foreground leading-relaxed text-xs">{member.bio}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="px-4 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">First Name</FormLabel>
                    <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Last Name</FormLabel>
                    <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Gender</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="birthDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Birth Date</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-8 text-xs" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="deathDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Death Date</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-8 text-xs" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="birthPlace" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Birth Place</FormLabel>
                  <FormControl><Input {...field} className="h-8 text-xs" placeholder="City, Country" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Bio</FormLabel>
                  <FormControl><Textarea {...field} className="text-xs min-h-16 resize-none" /></FormControl>
                </FormItem>
              )} />
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={updateMember.isPending}>
                  {updateMember.isPending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Add relatives */}
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add Relative</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { label: "Parent", icon: ChevronUp, type: "parent" as const, color: "hsl(200, 80%, 55%)" },
                { label: "Child", icon: ChevronDown, type: "child" as const, color: "hsl(140, 60%, 50%)" },
                { label: "Spouse", icon: Heart, type: "spouse" as const, color: "hsl(340, 75%, 62%)" },
              ]
            ).map((btn) => (
              <button
                key={btn.label}
                onClick={() => onAddRelative(btn.type)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors text-xs"
              >
                <btn.icon className="w-4 h-4" style={{ color: btn.color }} />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      {isGatekeeper && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-border/50 flex gap-2">
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
            onClick={() => onDelete(member)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
