import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListMembers,
  getListMembersQueryKey,
  useListRelationships,
  getListRelationshipsQueryKey,
  useUpdateMember,
  useCreateMember,
  useCreateRelationship,
  useCalculateRelationship,
  getCalculateRelationshipQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import Draggable, { DraggableData, DraggableEvent } from "react-draggable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ZoomIn, ZoomOut, Maximize, Plus, UserPlus, X, Link as LinkIcon } from "lucide-react";

export default function Tree() {
  const { familyId, isGatekeeper } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: members = [], isLoading: loadingMembers } = useListMembers(
    familyId ?? "",
    { query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") } }
  );

  const { data: relationships = [], isLoading: loadingRels } = useListRelationships(
    familyId ?? "",
    { query: { enabled: !!familyId, queryKey: getListRelationshipsQueryKey(familyId ?? "") } }
  );

  const updateMember = useUpdateMember();
  const createMember = useCreateMember();
  const createRelationship = useCreateRelationship();

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addRelOpen, setAddRelOpen] = useState(false);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const scaleChange = e.deltaY * -0.005;
      setTransform(prev => ({
        ...prev,
        scale: Math.min(Math.max(0.2, prev.scale + scaleChange), 3)
      }));
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, []);

  const handleDragCanvas = (e: React.MouseEvent) => {
    if (dragging) return;
    const startX = e.clientX - transform.x;
    const startY = e.clientY - transform.y;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setTransform(prev => ({
        ...prev,
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY
      }));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleNodeDragStop = (id: string, e: DraggableEvent, data: DraggableData) => {
    setTimeout(() => setDragging(false), 50);
    const member = members.find(m => m.id === id);
    if (!member) return;
    
    // Only update if changed
    if (member.posX !== data.x || member.posY !== data.y) {
      updateMember.mutate({
        familyId: familyId ?? "",
        memberId: id,
        data: { posX: data.x, posY: data.y }
      }, {
        onSuccess: () => {
          qc.setQueryData(getListMembersQueryKey(familyId ?? ""), (old: any) => 
            old ? old.map((m: any) => m.id === id ? { ...m, posX: data.x, posY: data.y } : m) : old
          );
        }
      });
    }
  };

  // SVG edges
  const edges = useMemo(() => {
    return relationships.map(rel => {
      const from = members.find(m => m.id === rel.fromMemberId);
      const to = members.find(m => m.id === rel.toMemberId);
      if (!from || !to) return null;

      const fromX = (from.posX ?? 0) + 40;
      const fromY = (from.posY ?? 0) + 50;
      const toX = (to.posX ?? 0) + 40;
      const toY = (to.posY ?? 0) + 50;

      let d = "";
      let stroke = "";

      if (rel.type === "parent") {
        const startY = fromY + 50;
        const endY = toY - 50;
        d = `M ${fromX} ${startY} C ${fromX} ${(startY + endY) / 2}, ${toX} ${(startY + endY) / 2}, ${toX} ${endY}`;
        stroke = "var(--color-amber-400, #fbbf24)";
      } else if (rel.type === "spouse") {
        const startX = fromX + 40;
        const endX = toX - 40;
        d = `M ${startX} ${fromY} C ${(startX + endX) / 2} ${fromY}, ${(startX + endX) / 2} ${toY}, ${endX} ${toY}`;
        stroke = "var(--color-rose-400, #fb7185)";
      } else if (rel.type === "sibling") {
        const startY = fromY - 50;
        const endY = toY - 50;
        d = `M ${fromX} ${startY} C ${fromX} ${startY - 100}, ${toX} ${endY - 100}, ${toX} ${endY}`;
        stroke = "var(--color-sky-400, #38bdf8)";
      }

      return <path key={rel.id} d={d} stroke={stroke} strokeWidth={3} fill="none" className="opacity-60" />;
    }).filter(Boolean);
  }, [members, relationships]);

  // Modals state
  const [newMember, setNewMember] = useState({ firstName: "", lastName: "", gender: "unknown", birthDate: "" });
  const [newRel, setNewRel] = useState({ fromMemberId: "", toMemberId: "", type: "parent" });

  const onAddMember = () => {
    if (!familyId) return;
    createMember.mutate({
      familyId,
      data: { ...newMember, gender: newMember.gender as any }
    }, {
      onSuccess: () => {
        toast({ title: "Member added" });
        setAddMemberOpen(false);
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId) });
      }
    });
  };

  const onAddRel = () => {
    if (!familyId) return;
    createRelationship.mutate({
      familyId,
      data: newRel as any
    }, {
      onSuccess: () => {
        toast({ title: "Relationship added" });
        setAddRelOpen(false);
        qc.invalidateQueries({ queryKey: getListRelationshipsQueryKey(familyId) });
      }
    });
  };

  // Calculator
  const [calcFrom, setCalcFrom] = useState("");
  const [calcTo, setCalcTo] = useState("");
  const [calcEnabled, setCalcEnabled] = useState(false);

  const { data: calcData } = useCalculateRelationship(
    familyId ?? "",
    { fromMemberId: calcFrom, toMemberId: calcTo },
    { query: { enabled: calcEnabled && !!familyId && !!calcFrom && !!calcTo, queryKey: getCalculateRelationshipQueryKey(familyId ?? "", { fromMemberId: calcFrom, toMemberId: calcTo }) } }
  );
  const calcResult = calcData?.description ?? "";

  const doCalculate = () => {
    if (!familyId || !calcFrom || !calcTo) return;
    setCalcEnabled(true);
  };

  if (loadingMembers || loadingRels) {
    return <div className="h-full flex items-center justify-center bg-background/50 animate-pulse text-muted-foreground">Loading tree...</div>;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-dot-pattern" ref={containerRef} onWheel={handleWheel} onMouseDown={handleDragCanvas}>
      <div 
        className="absolute origin-top-left transition-transform duration-75 ease-linear will-change-transform"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        <svg className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible">
          {edges}
        </svg>

        {members.map(member => {
          const borderClass = member.gender === "male" ? "border-sky-300" : member.gender === "female" ? "border-rose-300" : "border-muted";
          return (
            <Draggable
              key={member.id}
              position={{ x: member.posX ?? 0, y: member.posY ?? 0 }}
              onStart={() => setDragging(true)}
              onStop={(e, data) => handleNodeDragStop(member.id, e, data)}
              disabled={!isGatekeeper}
            >
              <div 
                className={`absolute cursor-grab active:cursor-grabbing w-[80px] h-[100px] rounded-xl glass-panel flex flex-col items-center p-2 border-2 ${borderClass} hover:shadow-xl transition-shadow`}
                data-testid={`node-${member.id}`}
              >
                <Link href={`/profile/${member.id}`} className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm overflow-hidden pointer-events-auto">
                  {member.avatarUrl ? <img src={member.avatarUrl} alt={member.firstName} className="w-full h-full object-cover" /> : `${member.firstName[0]}${member.lastName?.[0] || ""}`}
                </Link>
                <span className="text-xs font-semibold mt-1 text-center leading-tight line-clamp-1">{member.firstName}</span>
                <span className="text-[10px] text-muted-foreground">{member.birthDate ? new Date(member.birthDate).getFullYear() : "?"}</span>
              </div>
            </Draggable>
          );
        })}
      </div>

      <div className="absolute top-4 left-4 glass-panel p-2 flex items-center gap-2 rounded-lg pointer-events-auto">
        <Button variant="ghost" size="icon" onClick={() => setTransform(p => ({ ...p, scale: p.scale * 1.2 }))}><ZoomIn className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setTransform(p => ({ ...p, scale: p.scale / 1.2 }))}><ZoomOut className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}><Maximize className="w-4 h-4" /></Button>
        <div className="w-px h-6 bg-border mx-1" />
        {isGatekeeper && (
          <>
            <Button variant="outline" size="sm" onClick={() => setAddMemberOpen(true)} data-testid="btn-add-member">
              <UserPlus className="w-4 h-4 mr-2" /> Add Member
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddRelOpen(true)} data-testid="btn-add-rel">
              <LinkIcon className="w-4 h-4 mr-2" /> Add Relationship
            </Button>
          </>
        )}
      </div>

      <div className="absolute bottom-4 right-4 glass-panel p-4 rounded-xl w-72 pointer-events-auto shadow-2xl">
        <h3 className="text-sm font-semibold mb-3">Calculate Relationship</h3>
        <div className="space-y-2">
          <Select value={calcFrom} onValueChange={setCalcFrom}>
            <SelectTrigger><SelectValue placeholder="From..." /></SelectTrigger>
            <SelectContent>
              {members.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={calcTo} onValueChange={setCalcTo}>
            <SelectTrigger><SelectValue placeholder="To..." /></SelectTrigger>
            <SelectContent>
              {members.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={doCalculate} disabled={!calcFrom || !calcTo}>
            Calculate
          </Button>
          {calcResult && (
            <div className="mt-2 p-2 bg-primary/10 text-primary text-center rounded-md font-medium text-sm animate-in fade-in slide-in-from-bottom-2">
              {calcResult}
            </div>
          )}
        </div>
      </div>

      {members.length === 0 && !loadingMembers && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass-panel p-8 rounded-2xl text-center pointer-events-auto">
            <h2 className="text-xl font-bold mb-2">Empty Family Tree</h2>
            <p className="text-muted-foreground mb-4">Start building your family history.</p>
            {isGatekeeper && (
              <Button onClick={() => setAddMemberOpen(true)}><UserPlus className="w-4 h-4 mr-2" />Add First Member</Button>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Family Member</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={newMember.firstName} onChange={e => setNewMember(p => ({...p, firstName: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={newMember.lastName} onChange={e => setNewMember(p => ({...p, lastName: e.target.value}))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={newMember.gender} onValueChange={v => setNewMember(p => ({...p, gender: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Birth Date</Label>
              <Input type="date" value={newMember.birthDate} onChange={e => setNewMember(p => ({...p, birthDate: e.target.value}))} />
            </div>
            <Button onClick={onAddMember} className="w-full" disabled={!newMember.firstName}>Save Member</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addRelOpen} onOpenChange={setAddRelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Relationship</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>From Member</Label>
              <Select value={newRel.fromMemberId} onValueChange={v => setNewRel(p => ({...p, fromMemberId: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <Select value={newRel.type} onValueChange={v => setNewRel(p => ({...p, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent of</SelectItem>
                  <SelectItem value="spouse">Spouse of</SelectItem>
                  <SelectItem value="sibling">Sibling of</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Member</Label>
              <Select value={newRel.toMemberId} onValueChange={v => setNewRel(p => ({...p, toMemberId: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onAddRel} className="w-full" disabled={!newRel.fromMemberId || !newRel.toMemberId}>Save Relationship</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
