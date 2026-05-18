import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireGatekeeper, requireFamilyAccess } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { getOpenAI } from "../lib/openai";
import type { Request, Response } from "express";

const router = Router();

function serializeMember(id: string, data: FirebaseFirestore.DocumentData, familyId: string) {
  return {
    id,
    familyId,
    firstName: data.firstName,
    lastName: data.lastName,
    gender: data.gender ?? null,
    birthDate: data.birthDate ?? null,
    deathDate: data.deathDate ?? null,
    birthPlace: data.birthPlace ?? null,
    bio: data.bio ?? null,
    avatarUrl: data.avatarUrl ?? null,
    posX: data.posX ?? null,
    posY: data.posY ?? null,
    linkedUserId: data.linkedUserId ?? null,
    role: data.role ?? null,
    locationLat: data.locationLat ?? null,
    locationLng: data.locationLng ?? null,
    locationName: data.locationName ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

function serializeRelationship(id: string, data: FirebaseFirestore.DocumentData, familyId: string) {
  return {
    id,
    familyId,
    fromMemberId: data.fromMemberId,
    toMemberId: data.toMemberId,
    type: data.type,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

// GET /api/families/:familyId/members
router.get("/families/:familyId/members", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/members`).get();
  res.json(snap.docs.map(d => serializeMember(d.id, d.data(), familyId)));
});

// POST /api/families/:familyId/members
router.post("/families/:familyId/members", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { firstName, lastName, gender, birthDate, deathDate, birthPlace, bio, avatarUrl, posX, posY, linkedUserId } = req.body;

  if (!firstName || !lastName) {
    res.status(400).json({ error: "firstName and lastName are required" });
    return;
  }

  // Data integrity: validate birthDate < deathDate
  if (birthDate && deathDate && new Date(birthDate) >= new Date(deathDate)) {
    res.status(400).json({ error: "birthDate must be before deathDate" });
    return;
  }

  const db = getFirestore();
  const memberId = uuidv4();
  const data = {
    firstName, lastName,
    gender: gender ?? null,
    birthDate: birthDate ?? null,
    deathDate: deathDate ?? null,
    birthPlace: birthPlace ?? null,
    bio: bio ?? null,
    avatarUrl: avatarUrl ?? null,
    posX: posX ?? null,
    posY: posY ?? null,
    linkedUserId: linkedUserId ?? null,
    role: null,
    locationLat: null,
    locationLng: null,
    locationName: null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection(`families/${familyId}/members`).doc(memberId).set(data);
  await db.collection("families").doc(familyId).update({ memberCount: FieldValue.increment(1) });

  await logAudit({ action: "member.create", userId: req.user!.id, familyId, details: `${firstName} ${lastName}` });

  res.status(201).json(serializeMember(memberId, { ...data, createdAt: { toDate: () => new Date() } }, familyId));
});

// GET /api/families/:familyId/members/:memberId
router.get("/families/:familyId/members/:memberId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const memberId = req.params.memberId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/members`).doc(memberId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(serializeMember(snap.id, snap.data()!, familyId));
});

// PATCH /api/families/:familyId/members/:memberId
router.patch("/families/:familyId/members/:memberId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const memberId = req.params.memberId as string;

  // Data integrity guard
  const { birthDate, deathDate } = req.body;
  if (birthDate && deathDate && new Date(birthDate) >= new Date(deathDate)) {
    res.status(400).json({ error: "birthDate must be before deathDate" });
    return;
  }

  const db = getFirestore();
  const allowed = ["firstName", "lastName", "gender", "birthDate", "deathDate", "birthPlace", "bio", "avatarUrl", "posX", "posY", "locationLat", "locationLng", "locationName"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  await db.collection(`families/${familyId}/members`).doc(memberId).update(updates);
  const snap = await db.collection(`families/${familyId}/members`).doc(memberId).get();
  res.json(serializeMember(snap.id, snap.data()!, familyId));
});

// DELETE /api/families/:familyId/members/:memberId
router.delete("/families/:familyId/members/:memberId", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const memberId = req.params.memberId as string;
  const db = getFirestore();
  await db.collection(`families/${familyId}/members`).doc(memberId).delete();
  await db.collection("families").doc(familyId).update({ memberCount: FieldValue.increment(-1) });
  res.status(204).send();
});

// PATCH /api/families/:familyId/members/:memberId/role
router.patch("/families/:familyId/members/:memberId/role", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const memberId = req.params.memberId as string;
  const { role } = req.body;

  if (!["user", "editor", "gatekeeper"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const db = getFirestore();
  // Update member doc
  await db.collection(`families/${familyId}/members`).doc(memberId).update({ role });

  // Also update the linked user if any
  const memberSnap = await db.collection(`families/${familyId}/members`).doc(memberId).get();
  const memberData = memberSnap.data()!;
  if (memberData.linkedUserId) {
    await db.collection("users").doc(memberData.linkedUserId).update({ role });
  }

  await logAudit({ action: "member.role_update", userId: req.user!.id, familyId, details: `${memberId}=${role}` });

  res.json(serializeMember(memberSnap.id, memberSnap.data()!, familyId));
});

// GET /api/families/:familyId/relationships
router.get("/families/:familyId/relationships", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/relationships`).get();
  res.json(snap.docs.map(d => serializeRelationship(d.id, d.data(), familyId)));
});

// POST /api/families/:familyId/relationships
router.post("/families/:familyId/relationships", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { fromMemberId, toMemberId, type } = req.body;

  if (!fromMemberId || !toMemberId || !type) {
    res.status(400).json({ error: "fromMemberId, toMemberId, and type are required" });
    return;
  }

  if (!["parent", "spouse", "sibling"].includes(type)) {
    res.status(400).json({ error: "type must be parent, spouse, or sibling" });
    return;
  }

  // Data integrity: prevent circular parent relationships
  if (type === "parent") {
    const db = getFirestore();
    // Simple cycle check: ensure fromMemberId is not already an ancestor of toMemberId
    const allRels = await db.collection(`families/${familyId}/relationships`).where("type", "==", "parent").get();
    const childToParents: Record<string, string[]> = {};
    for (const doc of allRels.docs) {
      const d = doc.data();
      if (!childToParents[d.toMemberId]) childToParents[d.toMemberId] = [];
      childToParents[d.toMemberId].push(d.fromMemberId);
    }
    // BFS ancestors of fromMemberId
    const ancestors = new Set<string>();
    const queue = [fromMemberId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const p of childToParents[current] ?? []) {
        if (!ancestors.has(p)) {
          ancestors.add(p);
          queue.push(p);
        }
      }
    }
    if (ancestors.has(toMemberId)) {
      res.status(400).json({ error: "Circular lineage detected: this would create a paradox" });
      return;
    }
  }

  const db = getFirestore();
  const relId = uuidv4();
  const data = { fromMemberId, toMemberId, type, createdAt: FieldValue.serverTimestamp() };
  await db.collection(`families/${familyId}/relationships`).doc(relId).set(data);

  res.status(201).json(serializeRelationship(relId, { ...data, createdAt: { toDate: () => new Date() } }, familyId));
});

// DELETE /api/families/:familyId/relationships/:relationshipId
router.delete("/families/:familyId/relationships/:relationshipId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const relationshipId = req.params.relationshipId as string;
  const db = getFirestore();
  await db.collection(`families/${familyId}/relationships`).doc(relationshipId).delete();
  res.status(204).send();
});

// GET /api/families/:familyId/relationship-path (AI)
router.get("/families/:familyId/relationship-path", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { fromMemberId, toMemberId } = req.query as { fromMemberId: string; toMemberId: string };

  if (!fromMemberId || !toMemberId) {
    res.status(400).json({ error: "fromMemberId and toMemberId required" });
    return;
  }

  const db = getFirestore();
  const [fromSnap, toSnap, relsSnap] = await Promise.all([
    db.collection(`families/${familyId}/members`).doc(fromMemberId).get(),
    db.collection(`families/${familyId}/members`).doc(toMemberId).get(),
    db.collection(`families/${familyId}/relationships`).get(),
  ]);

  if (!fromSnap.exists || !toSnap.exists) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const fromData = fromSnap.data()!;
  const toData = toSnap.data()!;
  const rels = relsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // BFS to find path between nodes
  const graph: Record<string, Array<{ id: string; rel: string }>> = {};
  for (const rel of rels as any[]) {
    if (!graph[rel.fromMemberId]) graph[rel.fromMemberId] = [];
    if (!graph[rel.toMemberId]) graph[rel.toMemberId] = [];
    graph[rel.fromMemberId].push({ id: rel.toMemberId, rel: rel.type });
    graph[rel.toMemberId].push({ id: rel.fromMemberId, rel: rel.type });
  }

  const pathIds: string[] = [fromMemberId];
  const visited = new Set([fromMemberId]);
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromMemberId, path: [fromMemberId] }];
  let foundPath: string[] | null = null;

  while (queue.length) {
    const { id, path } = queue.shift()!;
    if (id === toMemberId) {
      foundPath = path;
      break;
    }
    for (const neighbor of graph[id] ?? []) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push({ id: neighbor.id, path: [...path, neighbor.id] });
      }
    }
  }

  try {
    const openai = getOpenAI();
    const prompt = `Given a family tree, calculate the relationship between two people.
Person A: ${fromData.firstName} ${fromData.lastName} (born: ${fromData.birthDate ?? "unknown"}, gender: ${fromData.gender ?? "unknown"})
Person B: ${toData.firstName} ${toData.lastName} (born: ${toData.birthDate ?? "unknown"}, gender: ${toData.gender ?? "unknown"})
Relationships in tree: ${JSON.stringify(rels.slice(0, 50))}
Path between them: ${foundPath ? foundPath.join(" -> ") : "no direct path found"}

Return ONLY a short plain-language description of how Person B relates to Person A (e.g., "maternal second cousin once removed", "paternal grandfather", "great-aunt"). Be specific and accurate.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
    });

    const description = completion.choices[0]?.message?.content?.trim() ?? "relationship unknown";
    res.json({ description, path: foundPath ?? [] });
  } catch {
    const description = foundPath ? `${foundPath.length - 1} relationship step(s) apart` : "No relationship path found";
    res.json({ description, path: foundPath ?? [] });
  }
});

// GET /api/families/:familyId/map-pins
router.get("/families/:familyId/map-pins", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/map_pins`).get();
  res.json(snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      familyId,
      memberId: data.memberId,
      memberName: data.memberName ?? "",
      memberAvatar: data.memberAvatar ?? null,
      lat: data.lat,
      lng: data.lng,
      locationName: data.locationName,
      description: data.description ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }));
});

// POST /api/families/:familyId/map-pins
router.post("/families/:familyId/map-pins", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { memberId, lat, lng, locationName, description } = req.body;

  if (!memberId || lat === undefined || lng === undefined || !locationName) {
    res.status(400).json({ error: "memberId, lat, lng, locationName required" });
    return;
  }

  const db = getFirestore();
  const memberSnap = await db.collection(`families/${familyId}/members`).doc(memberId).get();
  const memberData = memberSnap.exists ? memberSnap.data()! : {};

  const pinId = uuidv4();
  const data = {
    memberId,
    memberName: `${memberData.firstName ?? ""} ${memberData.lastName ?? ""}`.trim(),
    memberAvatar: memberData.avatarUrl ?? null,
    lat,
    lng,
    locationName,
    description: description ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection(`families/${familyId}/map_pins`).doc(pinId).set(data);

  res.status(201).json({
    id: pinId,
    familyId,
    ...data,
    createdAt: new Date().toISOString(),
  });
});

// DELETE /api/families/:familyId/map-pins/:pinId
router.delete("/families/:familyId/map-pins/:pinId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const pinId = req.params.pinId as string;
  const db = getFirestore();
  await db.collection(`families/${familyId}/map_pins`).doc(pinId).delete();
  res.status(204).send();
});

export default router;
