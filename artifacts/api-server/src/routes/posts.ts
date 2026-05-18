import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireFamilyAccess } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import type { Request, Response } from "express";

const router = Router();

function serializePost(id: string, data: FirebaseFirestore.DocumentData, familyId: string) {
  const now = new Date();
  const unlockAt = data.unlockAt?.toDate ? data.unlockAt.toDate() : (data.unlockAt ? new Date(data.unlockAt) : null);
  const isLocked = data.isCapsule && unlockAt && unlockAt > now;
  return {
    id,
    familyId,
    authorId: data.authorId,
    authorName: data.authorName ?? "",
    authorAvatar: data.authorAvatar ?? null,
    content: isLocked ? "[This message is locked until " + unlockAt!.toISOString() + "]" : data.content,
    mediaUrls: isLocked ? [] : (data.mediaUrls ?? []),
    taggedMembers: data.taggedMembers ?? [],
    reactions: data.reactions ?? { like: 0, love: 0, celebrate: 0 },
    commentCount: data.commentCount ?? 0,
    isCapsule: data.isCapsule ?? false,
    unlockAt: unlockAt?.toISOString() ?? null,
    isLocked: isLocked ?? false,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? now.toISOString(),
  };
}

// GET /api/families/:familyId/posts
router.get("/families/:familyId/posts", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { memberId, cursor } = req.query as { memberId?: string; cursor?: string };
  const PAGE_SIZE = 20;

  const db = getFirestore();
  let query = db.collection(`families/${familyId}/posts`).orderBy("createdAt", "desc").limit(PAGE_SIZE + 1);

  if (memberId) {
    query = db.collection(`families/${familyId}/posts`)
      .where("taggedMembers", "array-contains", memberId)
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE + 1);
  }

  if (cursor) {
    const cursorSnap = await db.collection(`families/${familyId}/posts`).doc(cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > PAGE_SIZE;
  const pageDocs = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

  const posts = pageDocs.map(d => serializePost(d.id, d.data(), familyId));
  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

  res.json({ posts, nextCursor, hasMore });
});

// POST /api/families/:familyId/posts
router.post("/families/:familyId/posts", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { content, mediaUrls, taggedMembers, isCapsule, unlockAt } = req.body;

  if (!content) {
    res.status(400).json({ error: "content required" });
    return;
  }

  if (isCapsule && !unlockAt) {
    res.status(400).json({ error: "unlockAt is required for time-capsule posts" });
    return;
  }

  const db = getFirestore();
  const postId = uuidv4();

  // Get author info
  const userSnap = await db.collection("users").doc(req.user!.id).get();
  const userData = userSnap.data()!;

  const data = {
    authorId: req.user!.id,
    authorName: userData.displayName ?? req.user!.displayName,
    authorAvatar: userData.avatarUrl ?? null,
    content,
    mediaUrls: mediaUrls ?? [],
    taggedMembers: taggedMembers ?? [],
    reactions: { like: 0, love: 0, celebrate: 0 },
    commentCount: 0,
    isCapsule: isCapsule ?? false,
    unlockAt: unlockAt ? new Date(unlockAt) : null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection(`families/${familyId}/posts`).doc(postId).set(data);

  // Notify tagged members
  if (taggedMembers?.length) {
    const batch = db.batch();
    for (const memberId of taggedMembers) {
      const notifId = uuidv4();
      batch.set(db.collection(`families/${familyId}/notifications`).doc(notifId), {
        userId: memberId,
        familyId,
        type: "tag",
        message: `${userData.displayName} tagged you in a post`,
        linkId: postId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  res.status(201).json(serializePost(postId, { ...data, createdAt: { toDate: () => new Date() } }, familyId));
});

// GET /api/families/:familyId/posts/:postId
router.get("/families/:familyId/posts/:postId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const postId = req.params.postId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/posts`).doc(postId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(serializePost(snap.id, snap.data()!, familyId));
});

// DELETE /api/families/:familyId/posts/:postId
router.delete("/families/:familyId/posts/:postId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const postId = req.params.postId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/posts`).doc(postId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const data = snap.data()!;
  if (data.authorId !== req.user!.id && !["gatekeeper", "master_admin"].includes(req.user!.role)) {
    res.status(403).json({ error: "Cannot delete another user's post" });
    return;
  }
  await snap.ref.delete();
  res.status(204).send();
});

// POST /api/families/:familyId/posts/:postId/react
router.post("/families/:familyId/posts/:postId/react", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const postId = req.params.postId as string;
  const { type } = req.body;

  if (!["like", "love", "celebrate"].includes(type)) {
    res.status(400).json({ error: "Invalid reaction type" });
    return;
  }

  const db = getFirestore();
  const reactionRef = db.collection(`families/${familyId}/posts/${postId}/user_reactions`).doc(req.user!.id);
  const existing = await reactionRef.get();

  const postRef = db.collection(`families/${familyId}/posts`).doc(postId);

  if (existing.exists && existing.data()!.type === type) {
    // Toggle off
    await reactionRef.delete();
    await postRef.update({ [`reactions.${type}`]: FieldValue.increment(-1) });
  } else {
    if (existing.exists) {
      // Remove old reaction
      await postRef.update({ [`reactions.${existing.data()!.type}`]: FieldValue.increment(-1) });
    }
    await reactionRef.set({ type, userId: req.user!.id });
    await postRef.update({ [`reactions.${type}`]: FieldValue.increment(1) });
  }

  const snap = await postRef.get();
  res.json(serializePost(snap.id, snap.data()!, familyId));
});

// GET /api/families/:familyId/capsules
router.get("/families/:familyId/capsules", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/posts`).where("isCapsule", "==", true).orderBy("unlockAt", "asc").get();
  const now = new Date();
  const unlocked = snap.docs
    .map(d => serializePost(d.id, d.data(), familyId));
  res.json(unlocked);
});

export default router;
