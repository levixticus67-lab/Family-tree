import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserPlus, ChevronUp, ChevronDown, Heart } from "lucide-react";

interface MemberData {
  id: string;
  firstName: string;
  lastName: string;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  birthPlace?: string | null;
  avatarUrl?: string | null;
}

interface NodeData {
  member: MemberData;
  isSelected: boolean;
  onSelect: () => void;
  onAddParent: () => void;
  onAddChild: () => void;
  onAddSpouse: () => void;
}

const genderColors: Record<string, string> = {
  male: "hsl(200, 80%, 55%)",
  female: "hsl(340, 75%, 62%)",
  unknown: "hsl(var(--primary))",
};

function TreeNode({ data }: NodeProps & { data: NodeData }) {
  const { member, isSelected, onSelect, onAddParent, onAddChild, onAddSpouse } = data;
  const initials = `${(member.firstName ?? "")[0] ?? ""}${(member.lastName ?? "")[0] ?? ""}`.toUpperCase();
  const birthYear = member.birthDate ? new Date(member.birthDate).getFullYear() : null;
  const deathYear = member.deathDate ? new Date(member.deathDate).getFullYear() : null;
  const isDeceased = !!member.deathDate;
  const genderColor = genderColors[member.gender ?? "unknown"] ?? genderColors.unknown;

  return (
    <div
      onClick={onSelect}
      className="tree-node-card group relative"
      style={{
        width: 200,
        cursor: "pointer",
        borderRadius: 12,
        border: `2px solid ${isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
        background: "hsl(var(--card))",
        boxShadow: isSelected
          ? "var(--glow-primary), 0 4px 24px rgba(0,0,0,0.3)"
          : "0 4px 20px rgba(0,0,0,0.2)",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        transform: isSelected ? "scale(1.03)" : undefined,
        opacity: isDeceased ? 0.8 : 1,
        userSelect: "none",
      }}
    >
      {/* Handles — invisible but functional */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: -1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, bottom: -1 }} />
      <Handle type="source" id="left" position={Position.Left} style={{ opacity: 0, left: -1 }} />
      <Handle type="target" id="right" position={Position.Right} style={{ opacity: 0, right: -1 }} />

      {/* Gender accent bar */}
      <div
        style={{
          height: 3,
          borderRadius: "10px 10px 0 0",
          background: genderColor,
          opacity: 0.8,
        }}
      />

      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Avatar */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: `${genderColor}22`,
              border: `1.5px solid ${genderColor}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: genderColor,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={initials}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initials || "?"
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: 13,
                color: "hsl(var(--foreground))",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {member.firstName} {member.lastName}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
              {birthYear ? (
                isDeceased
                  ? `${birthYear} – ${deathYear ?? "?"}`
                  : `b. ${birthYear}`
              ) : (
                <span style={{ opacity: 0.5 }}>No date</span>
              )}
            </p>
            {member.birthPlace && (
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  color: "hsl(var(--muted-foreground))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {member.birthPlace}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons — always visible but subtle */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 8,
            justifyContent: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(
            [
              { label: "Add Parent", icon: ChevronUp, action: onAddParent, color: "hsl(200, 80%, 55%)" },
              { label: "Add Child", icon: ChevronDown, action: onAddChild, color: "hsl(140, 60%, 50%)" },
              { label: "Add Spouse", icon: Heart, action: onAddSpouse, color: "hsl(340, 75%, 62%)" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.label}
              onClick={(e) => { e.stopPropagation(); btn.action(); }}
              title={btn.label}
              style={{
                flex: 1,
                height: 26,
                borderRadius: 6,
                border: `1px solid hsl(var(--border))`,
                background: "hsl(var(--muted) / 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${btn.color}20`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${btn.color}60`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--muted) / 0.5)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(var(--border))";
              }}
            >
              <btn.icon style={{ width: 12, height: 12, color: btn.color }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(TreeNode);
