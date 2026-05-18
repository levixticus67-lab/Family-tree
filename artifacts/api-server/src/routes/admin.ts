import { Router } from "express";
import { getFirestore } from "../lib/firebase";
import { requireAuth, requireMasterAdmin } from "../middlewares/auth";
import type { Request, Response } from "express";

const router = Router();

// GET /api/system-cockpit/stats
router.get("/system-cockpit/stats", requireAuth, requireMasterAdmin, async (req: Request, res: Response): Promise<void> => {
  const db = getFirestore();

  const [familiesSnap, usersSnap, postsSnap, mediaSnap] = await Promise.all([
    db.collection("families").get(),
    db.collection("users").get(),
    // Aggregate posts across families — simplified: count a sample
    db.collectionGroup("posts").limit(1000).get(),
    db.collectionGroup("media").limit(1000).get(),
  ]);

  const activeUsers = usersSnap.docs.filter(d => d.data().status === "active").length;
  const pendingUsers = usersSnap.docs.filter(d => d.data().status === "pending").length;

  res.json({
    totalFamilies: familiesSnap.size,
    totalUsers: usersSnap.size,
    activeUsers,
    pendingUsers,
    totalPosts: postsSnap.size,
    totalMedia: mediaSnap.size,
    cloudinaryUsageMB: 0, // Would require Cloudinary API call
    dbReadsToday: 0,
    dbWritesToday: 0,
  });
});

// GET /api/system-cockpit/families
router.get("/system-cockpit/families", requireAuth, requireMasterAdmin, async (req: Request, res: Response): Promise<void> => {
  const db = getFirestore();
  const snap = await db.collection("families").get();
  res.json(snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      description: data.description ?? null,
      coverUrl: data.coverUrl ?? null,
      familyTreeId: data.familyTreeId,
      gatekeeperId: data.gatekeeperId,
      theme: data.theme ?? "heritage",
      memberCount: data.memberCount ?? 0,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }));
});

// GET /api/system-cockpit/audit-logs
router.get("/system-cockpit/audit-logs", requireAuth, requireMasterAdmin, async (req: Request, res: Response): Promise<void> => {
  const db = getFirestore();
  const limit = Math.min(parseInt(req.query.limit as string ?? "100", 10), 500);
  const snap = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(limit).get();
  res.json(snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action,
      userId: data.userId ?? null,
      familyId: data.familyId ?? null,
      ipAddress: data.ipAddress ?? null,
      details: data.details ?? null,
      timestamp: data.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }));
});

export default router;
