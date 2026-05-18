import { Router } from "express";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireFamilyAccess } from "../middlewares/auth";
import type { Request, Response } from "express";

const router = Router();

// GET /api/families/:familyId/notifications
router.get("/families/:familyId/notifications", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { unreadOnly } = req.query;
  const db = getFirestore();

  let query: FirebaseFirestore.Query = db.collection(`families/${familyId}/notifications`)
    .where("userId", "==", req.user!.id)
    .orderBy("createdAt", "desc")
    .limit(50);

  if (unreadOnly === "true") {
    query = db.collection(`families/${familyId}/notifications`)
      .where("userId", "==", req.user!.id)
      .where("isRead", "==", false)
      .orderBy("createdAt", "desc")
      .limit(50);
  }

  const snap = await query.get();
  res.json(snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      familyId: data.familyId ?? familyId,
      type: data.type,
      message: data.message,
      linkId: data.linkId ?? null,
      isRead: data.isRead ?? false,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }));
});

// POST /api/families/:familyId/notifications/mark-read
router.post("/families/:familyId/notifications/mark-read", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { ids } = req.body;
  const db = getFirestore();

  if (ids && Array.isArray(ids) && ids.length) {
    const batch = db.batch();
    for (const id of ids) {
      batch.update(db.collection(`families/${familyId}/notifications`).doc(id), { isRead: true });
    }
    await batch.commit();
  } else {
    // Mark all read for this user
    const snap = await db.collection(`families/${familyId}/notifications`)
      .where("userId", "==", req.user!.id)
      .where("isRead", "==", false)
      .get();
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, { isRead: true });
    }
    await batch.commit();
  }

  res.json({ success: true });
});

export default router;
