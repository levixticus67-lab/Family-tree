import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireFamilyAccess } from "../middlewares/auth";
import { generateUploadSignature, deleteCloudinaryAsset } from "../lib/cloudinary";
import type { Request, Response } from "express";

const router = Router();

function serializeMedia(id: string, data: FirebaseFirestore.DocumentData, familyId: string) {
  return {
    id,
    familyId,
    uploaderId: data.uploaderId,
    uploaderName: data.uploaderName ?? "",
    cloudinaryId: data.cloudinaryId,
    url: data.url,
    thumbnailUrl: data.thumbnailUrl ?? null,
    type: data.type,
    title: data.title ?? null,
    description: data.description ?? null,
    taggedMembers: data.taggedMembers ?? [],
    duration: data.duration ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

// GET /api/families/:familyId/media
router.get("/families/:familyId/media", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { memberId, type } = req.query as { memberId?: string; type?: string };
  const db = getFirestore();

  let query: FirebaseFirestore.Query = db.collection(`families/${familyId}/media`).orderBy("createdAt", "desc");
  if (type) {
    query = query.where("type", "==", type);
  }
  if (memberId) {
    query = db.collection(`families/${familyId}/media`)
      .where("taggedMembers", "array-contains", memberId)
      .orderBy("createdAt", "desc");
  }

  const snap = await query.get();
  res.json(snap.docs.map(d => serializeMedia(d.id, d.data(), familyId)));
});

// POST /api/families/:familyId/media
router.post("/families/:familyId/media", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { cloudinaryId, url, thumbnailUrl, type, title, description, taggedMembers, duration } = req.body;

  if (!cloudinaryId || !url || !type) {
    res.status(400).json({ error: "cloudinaryId, url, and type required" });
    return;
  }

  const db = getFirestore();
  const userSnap = await db.collection("users").doc(req.user!.id).get();
  const userData = userSnap.data()!;

  const mediaId = uuidv4();
  const data = {
    uploaderId: req.user!.id,
    uploaderName: userData.displayName ?? req.user!.displayName,
    cloudinaryId,
    url,
    thumbnailUrl: thumbnailUrl ?? null,
    type,
    title: title ?? null,
    description: description ?? null,
    taggedMembers: taggedMembers ?? [],
    duration: duration ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection(`families/${familyId}/media`).doc(mediaId).set(data);

  // Notify tagged members
  if (taggedMembers?.length) {
    const batch = db.batch();
    for (const memberId of taggedMembers) {
      const notifId = uuidv4();
      batch.set(db.collection(`families/${familyId}/notifications`).doc(notifId), {
        userId: memberId,
        familyId,
        type: "tag",
        message: `${userData.displayName} tagged you in a ${type}`,
        linkId: mediaId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  res.status(201).json(serializeMedia(mediaId, { ...data, createdAt: { toDate: () => new Date() } }, familyId));
});

// DELETE /api/families/:familyId/media/:mediaId
router.delete("/families/:familyId/media/:mediaId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const mediaId = req.params.mediaId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/media`).doc(mediaId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Media not found" });
    return;
  }
  const data = snap.data()!;
  if (data.uploaderId !== req.user!.id && !["gatekeeper", "master_admin"].includes(req.user!.role)) {
    res.status(403).json({ error: "Cannot delete another user's media" });
    return;
  }
  // Delete from Cloudinary
  try {
    await deleteCloudinaryAsset(data.cloudinaryId);
  } catch { /* non-critical */ }

  await snap.ref.delete();
  res.status(204).send();
});

// POST /api/media/sign-upload
router.post("/media/sign-upload", requireAuth, requireActive, async (req: Request, res: Response): Promise<void> => {
  const { familyId, folder } = req.body;
  if (!familyId) {
    res.status(400).json({ error: "familyId required" });
    return;
  }
  const uploadFolder = folder ?? `family-tree/${familyId}`;
  const result = await generateUploadSignature(uploadFolder);
  res.json(result);
});

export default router;
