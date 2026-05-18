import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireFamilyAccess } from "../middlewares/auth";
import type { Request, Response } from "express";

const router = Router();

function serializeComment(id: string, data: FirebaseFirestore.DocumentData, postId: string) {
  return {
    id,
    postId,
    authorId: data.authorId,
    authorName: data.authorName ?? "",
    authorAvatar: data.authorAvatar ?? null,
    content: data.content,
    parentId: data.parentId ?? null,
    replies: [],
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

// GET /api/families/:familyId/posts/:postId/comments
router.get("/families/:familyId/posts/:postId/comments", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const postId = req.params.postId as string;
  const db = getFirestore();
  const snap = await db.collection(`families/${familyId}/posts/${postId}/comments`).orderBy("createdAt", "asc").get();

  const allComments = snap.docs.map(d => serializeComment(d.id, d.data(), postId));
  const topLevel = allComments.filter(c => !c.parentId);
  const replies = allComments.filter(c => c.parentId);

  // Nest replies
  for (const comment of topLevel) {
    comment.replies = replies.filter(r => r.parentId === comment.id) as any;
  }

  res.json(topLevel);
});

// POST /api/families/:familyId/posts/:postId/comments
router.post("/families/:familyId/posts/:postId/comments", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const postId = req.params.postId as string;
  const { content, parentId } = req.body;

  if (!content) {
    res.status(400).json({ error: "content required" });
    return;
  }

  const db = getFirestore();
  const userSnap = await db.collection("users").doc(req.user!.id).get();
  const userData = userSnap.data()!;

  const commentId = uuidv4();
  const data = {
    authorId: req.user!.id,
    authorName: userData.displayName ?? req.user!.displayName,
    authorAvatar: userData.avatarUrl ?? null,
    content,
    parentId: parentId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection(`families/${familyId}/posts/${postId}/comments`).doc(commentId).set(data);
  await db.collection(`families/${familyId}/posts`).doc(postId).update({ commentCount: FieldValue.increment(1) });

  // Notify post author
  const postSnap = await db.collection(`families/${familyId}/posts`).doc(postId).get();
  if (postSnap.exists) {
    const postData = postSnap.data()!;
    if (postData.authorId !== req.user!.id) {
      const notifId = uuidv4();
      await db.collection(`families/${familyId}/notifications`).doc(notifId).set({
        userId: postData.authorId,
        familyId,
        type: "comment",
        message: `${userData.displayName} commented on your post`,
        linkId: postId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  res.status(201).json(serializeComment(commentId, { ...data, createdAt: { toDate: () => new Date() } }, postId));
});

// DELETE /api/families/:familyId/posts/:postId/comments/:commentId
router.delete("/families/:familyId/posts/:postId/comments/:commentId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const postId = req.params.postId as string; const commentId = req.params.commentId as string;
  const db = getFirestore();
  await db.collection(`families/${familyId}/posts/${postId}/comments`).doc(commentId).delete();
  await db.collection(`families/${familyId}/posts`).doc(postId).update({ commentCount: FieldValue.increment(-1) });
  res.status(204).send();
});

export default router;
