import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireFamilyAccess } from "../middlewares/auth";
import type { Request, Response } from "express";

const router = Router();

function serializeEvent(id: string, data: FirebaseFirestore.DocumentData, familyId: string, myRsvp?: string | null) {
  return {
    id,
    familyId,
    creatorId: data.creatorId,
    creatorName: data.creatorName ?? "",
    title: data.title,
    description: data.description ?? null,
    startDate: data.startDate?.toDate?.()?.toISOString() ?? data.startDate,
    endDate: data.endDate?.toDate?.()?.toISOString() ?? data.endDate ?? null,
    location: data.location ?? null,
    locationLat: data.locationLat ?? null,
    locationLng: data.locationLng ?? null,
    coverUrl: data.coverUrl ?? null,
    rsvps: data.rsvps ?? { going: 0, not_going: 0, maybe: 0 },
    myRsvp: myRsvp ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

// GET /api/families/:familyId/events
router.get("/families/:familyId/events", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/events`).orderBy("startDate", "asc").get();

  const events = await Promise.all(snap.docs.map(async d => {
    const rsvpSnap = await d.ref.collection("rsvps").doc(req.user!.id).get();
    return serializeEvent(d.id, d.data(), familyId, rsvpSnap.exists ? rsvpSnap.data()!.status : null);
  }));
  res.json(events);
});

// POST /api/families/:familyId/events
router.post("/families/:familyId/events", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { title, description, startDate, endDate, location, locationLat, locationLng, coverUrl } = req.body;

  if (!title || !startDate) {
    res.status(400).json({ error: "title and startDate required" });
    return;
  }

  const db = getFirestore();
  const userSnap = await db.collection("users").doc(req.user!.id).get();
  const userData = userSnap.data()!;
  const eventId = uuidv4();

  const data = {
    creatorId: req.user!.id,
    creatorName: userData.displayName ?? req.user!.displayName,
    title,
    description: description ?? null,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    location: location ?? null,
    locationLat: locationLat ?? null,
    locationLng: locationLng ?? null,
    coverUrl: coverUrl ?? null,
    rsvps: { going: 0, not_going: 0, maybe: 0 },
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection(`families/${familyId}/events`).doc(eventId).set(data);
  res.status(201).json(serializeEvent(eventId, { ...data, createdAt: { toDate: () => new Date() } }, familyId, null));
});

// GET /api/families/:familyId/events/:eventId
router.get("/families/:familyId/events/:eventId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const eventId = req.params.eventId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/events`).doc(eventId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const rsvpSnap = await snap.ref.collection("rsvps").doc(req.user!.id).get();
  res.json(serializeEvent(snap.id, snap.data()!, familyId, rsvpSnap.exists ? rsvpSnap.data()!.status : null));
});

// PATCH /api/families/:familyId/events/:eventId
router.patch("/families/:familyId/events/:eventId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const eventId = req.params.eventId as string;
  const db = getFirestore();
  const allowed = ["title", "description", "startDate", "endDate", "location", "locationLat", "locationLng", "coverUrl"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = ["startDate", "endDate"].includes(key) && req.body[key] ? new Date(req.body[key]) : req.body[key];
    }
  }
  await db.collection(`families/${familyId}/events`).doc(eventId).update(updates);
  const snap = await db.collection(`families/${familyId}/events`).doc(eventId).get();
  const rsvpSnap = await snap.ref.collection("rsvps").doc(req.user!.id).get();
  res.json(serializeEvent(snap.id, snap.data()!, familyId, rsvpSnap.exists ? rsvpSnap.data()!.status : null));
});

// DELETE /api/families/:familyId/events/:eventId
router.delete("/families/:familyId/events/:eventId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const eventId = req.params.eventId as string;
  const db = getFirestore();
  await db.collection(`families/${familyId}/events`).doc(eventId).delete();
  res.status(204).send();
});

// POST /api/families/:familyId/events/:eventId/rsvp
router.post("/families/:familyId/events/:eventId/rsvp", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const eventId = req.params.eventId as string;
  const { status } = req.body;

  if (!["going", "not_going", "maybe"].includes(status)) {
    res.status(400).json({ error: "Invalid RSVP status" });
    return;
  }

  const db = getFirestore();
  const eventRef = db.collection(`families/${familyId}/events`).doc(eventId);
  const rsvpRef = eventRef.collection("rsvps").doc(req.user!.id);
  const existing = await rsvpRef.get();

  if (existing.exists) {
    const old = existing.data()!.status;
    await eventRef.update({ [`rsvps.${old}`]: FieldValue.increment(-1), [`rsvps.${status}`]: FieldValue.increment(1) });
  } else {
    await eventRef.update({ [`rsvps.${status}`]: FieldValue.increment(1) });
  }
  await rsvpRef.set({ status, userId: req.user!.id, updatedAt: FieldValue.serverTimestamp() });

  const snap = await eventRef.get();
  res.json(serializeEvent(snap.id, snap.data()!, familyId, status));
});

export default router;
