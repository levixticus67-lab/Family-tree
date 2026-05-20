import { useState, useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Panel,
} from "reactflow";
import type { Node, Edge, OnNodeDragStop } from "reactflow";
import "reactflow/dist/style.css";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMembers,
  useListRelationships,
  useUpdateMember,
  useDeleteMember,
  getListMembersQueryKey,
  getListRelationshipsQueryKey,
} from "@workspace/api-client-react";
import type { Member, Relationship } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import TreeNodeCard from "@/components/TreeNode";
import MemberPanel from "@/components/MemberPanel";
import AddRelativeModal from "@/components/AddRelativeModal";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GitBranch,
  MessageSquare,
  UserPlus,
  Search,
  LogOut,
  LayoutDashboard,
  X,
} from "lucide-react";

const nodeTypes = { memberNode: TreeNodeCard };

const X_GAP = 290;
const Y_GAP = 220;
const COLS = 5;

function buildPositions(members: Member[]): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  members.forEach((m, i) => {
    const hasPos =
      m.posX !== null &&
      m.posX !== undefined &&
      m.posY !== null &&
      m.posY !== undefined;
    map.set(m.id, {
      x: hasPos ? (m.posX as number) : (i % COLS) * X_GAP,
      y: hasPos ? (m.posY as number) : Math.floor(i / COLS) * Y_GAP,
    });
  });
  return map;
}

function buildEdges(relationships: Relationship[]): Edge[] {
  return relationships.map((r) => {
    const isSpouse = r.type === "spouse";
    const isSibling = r.type === "sibling";
    return {
      id: r.id,
      source: r.fromMemberId,
      target: r.toMemberId,
      type: isSpouse || isSibling ? "straight" : "smoothstep",
      style: {
        stroke: isSpouse ? "#f59e0b" : isSibling ? "#a78bfa" : "hsl(190deg 100% 50%)",
        strokeWidth: 2,
        strokeDasharray: isSpouse ? "6,4" : undefined,
        opacity: 0.75,
      },
      markerEnd:
        !isSpouse && !isSibling
          ? {
              type: MarkerType.ArrowClosed,
              color: "hsl(190deg 100% 50%)",
              width: 12,
              height: 12,
            }
          : undefined,
      label: r.type,
      labelStyle: { fontSize: 9, fill: "hsl(var(--muted-foreground))" },
      labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
    };
  });
}

export default function TreeWorkspace() {
  const { user, familyId, isMasterAdmin, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [addRelativeFor, setAddRelativeFor] = useState<{
    member: Member | null;
    type: "parent" | "child" | "spouse";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [familyName, setFamilyName] = useState("Family Tree");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { data: members = [], isLoading: loadingMembers } = useListMembers(
    familyId ?? "",
    { query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") } }
  );

  const { data: relationships = [], isLoading: loadingRels } = useListRelationships(
    familyId ?? "",
    { query: { enabled: !!familyId, queryKey: getListRelationshipsQueryKey(familyId ?? "") } }
  );

  const updateMember = useUpdateMember();
  const deleteMemberMutation = useDeleteMember();

  // Load family name
  useEffect(() => {
    if (!familyId) return;
    const token = localStorage.getItem("auth_token");
    fetch(`/api/families/${familyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setFamilyName(d.name))
      .catch(() => {});
  }, [familyId]);

  // Sync React Flow nodes/edges when data changes
  useEffect(() => {
    const positions = buildPositions(members);

    const newNodes: Node[] = members.map((m) => ({
      id: m.id,
      type: "memberNode",
      position: positions.get(m.id) ?? { x: 0, y: 0 },
      data: {
        member: m,
        isSelected: selectedMember?.id === m.id,
        onSelect: () => setSelectedMember(m),
        onAddParent: () => setAddRelativeFor({ member: m, type: "parent" }),
        onAddChild: () => setAddRelativeFor({ member: m, type: "child" }),
        onAddSpouse: () => setAddRelativeFor({ member: m, type: "spouse" }),
      },
    }));

    setNodes(newNodes);
    setEdges(buildEdges(relationships));
  }, [members, relationships, selectedMember]);

  const handleNodeDragStop: OnNodeDragStop = useCallback(
    (_, node) => {
      if (!familyId) return;
      updateMember.mutate(
        {
          familyId,
          memberId: node.id,
          data: { posX: node.position.x, posY: node.position.y } as any,
        },
        {
          onSuccess: () => {
            qc.setQueryData(getListMembersQueryKey(familyId), (old: any) =>
              old
                ? old.map((m: any) =>
                    m.id === node.id
                      ? { ...m, posX: node.position.x, posY: node.position.y }
                      : m
                  )
                : old
            );
          },
        }
      );
    },
    [familyId, updateMember, qc]
  );

  const handleDeleteMember = useCallback(
    (member: Member) => {
      if (!familyId) return;
      if (
        !window.confirm(
          `Remove ${member.firstName} ${member.lastName} from the tree? All their relationships will also be removed.`
        )
      )
        return;
      deleteMemberMutation.mutate(
        { familyId, memberId: member.id },
        {
          onSuccess: () => {
            setSelectedMember(null);
            qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId) });
            qc.invalidateQueries({ queryKey: getListRelationshipsQueryKey(familyId) });
            toast({ title: "Member removed from tree" });
          },
          onError: (e: any) => {
            toast({ title: e?.message ?? "Failed to remove member", variant: "destructive" });
          },
        }
      );
    },
    [familyId, deleteMemberMutation, qc, toast]
  );

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return members.filter((m) =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      (m.birthPlace ?? "").toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const isLoading = loadingMembers || loadingRels;

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* ─── HEADER ───────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 h-14 border-b border-border/50 flex items-center px-4 gap-3 z-10"
        style={{
          background: "hsl(var(--card) / 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 mr-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm hidden sm:block truncate max-w-[180px]">
            {familyName}
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          {showSearch ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
                placeholder="Search members by name or place…"
                className="pl-8 h-8 text-xs bg-background/60 border-border/50 pr-8"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
              {filteredMembers.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border/60 shadow-2xl z-50 overflow-hidden"
                  style={{ background: "hsl(var(--card))" }}
                >
                  {filteredMembers.slice(0, 7).map((m) => (
                    <button
                      key={m.id}
                      onMouseDown={() => {
                        setSelectedMember(m);
                        setSearchQuery("");
                        setShowSearch(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden"
                        style={{
                          background: "hsl(var(--primary) / 0.12)",
                          color: "hsl(var(--primary))",
                        }}
                      >
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          `${m.firstName[0]}${m.lastName[0]}`
                        )}
                      </div>
                      <span className="font-medium">
                        {m.firstName} {m.lastName}
                      </span>
                      {m.birthDate && (
                        <span className="ml-auto text-muted-foreground">
                          {new Date(m.birthDate).getFullYear()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border/40 text-xs text-muted-foreground hover:bg-muted/40 transition-colors w-full"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search members…</span>
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-border/50 hidden sm:flex"
            onClick={() => setAddRelativeFor({ member: null, type: "child" })}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Person
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 sm:hidden border-border/50"
            onClick={() => setAddRelativeFor({ member: null, type: "child" })}
          >
            <UserPlus className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            onClick={() => setLocation("/app/chat")}
            title="Family Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>

          {isMasterAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLocation("/admin")}
              title="Admin Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Button>
          )}

          <ThemeToggle />

          {/* User menu */}
          <div className="relative group">
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden border-2 transition-colors"
              style={{
                borderColor: "hsl(var(--primary) / 0.3)",
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
              }}
              title={user?.displayName}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                (user?.displayName?.[0] ?? "?").toUpperCase()
              )}
            </button>
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border/60 shadow-2xl py-1.5 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150"
              style={{ background: "hsl(var(--card))" }}
            >
              <div className="px-3 py-2 border-b border-border/40 mb-1">
                <p className="text-xs font-medium truncate">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-destructive"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── TREE CANVAS ──────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-12 h-12 rounded-full border-2 border-t-primary animate-spin"
                style={{ borderColor: "hsl(var(--border))", borderTopColor: "hsl(var(--primary))" }}
              />
              <p className="text-sm text-muted-foreground animate-pulse">Loading family tree…</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, minZoom: 0.3 }}
            minZoom={0.1}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: false }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1}
              color="hsl(var(--border) / 0.7)"
            />
            <Controls className="!bottom-6 !left-4 !shadow-none" showInteractive={false} />
            <MiniMap
              className="!bottom-6 !right-4"
              nodeColor="hsl(var(--primary) / 0.6)"
              maskColor="hsl(var(--background) / 0.8)"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
              }}
            />

            {/* Empty state */}
            {members.length === 0 && (
              <Panel position="top-center">
                <div
                  className="mt-12 rounded-2xl border border-border/60 px-10 py-8 text-center shadow-2xl"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: "hsl(var(--primary))" }} />
                  <h3 className="font-semibold text-lg mb-2">Your tree is empty</h3>
                  <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                    Add the first family member to start building your interactive tree.
                  </p>
                  <Button
                    onClick={() => setAddRelativeFor({ member: null, type: "child" })}
                    className="gap-2 glow-subtle"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add First Member
                  </Button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}

        {/* ─── PROFILE PANEL ────────────────────────────────────────── */}
        {selectedMember && (
          <MemberPanel
            member={selectedMember}
            familyId={familyId!}
            members={members}
            onClose={() => setSelectedMember(null)}
            onDelete={handleDeleteMember}
            onAddRelative={(type) =>
              setAddRelativeFor({ member: selectedMember, type })
            }
            onUpdated={() =>
              qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId!) })
            }
          />
        )}
      </div>

      {/* ─── ADD RELATIVE MODAL ───────────────────────────────────── */}
      {addRelativeFor !== null && (
        <AddRelativeModal
          forMember={addRelativeFor.member}
          relationshipType={addRelativeFor.type}
          familyId={familyId!}
          existingMembers={members}
          onClose={() => setAddRelativeFor(null)}
          onSuccess={() => {
            setAddRelativeFor(null);
            qc.invalidateQueries({ queryKey: getListMembersQueryKey(familyId!) });
            qc.invalidateQueries({ queryKey: getListRelationshipsQueryKey(familyId!) });
          }}
        />
      )}
    </div>
  );
}
