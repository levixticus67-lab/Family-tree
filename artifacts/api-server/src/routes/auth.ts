import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { signToken, requireAuth } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import type { Request, Response } from "express";

const router = Router();

// POST /api/auth/register
router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName, inviteToken, familyId: requestedFamilyId } = req.body;

  if (!email || !password || !displayName) {
    res.status(400).json({ error: "email, password, and displayName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const db = getFirestore();

  // Check existing user
  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  let resolvedFamilyId: string | null = null;
  let role = "user";

  // Validate invite token if provided
  if (inviteToken) {
    const tokenSnap = await db.collection("invite_tokens").where("token", "==", inviteToken).where("used", "==", false).limit(1).get();
    if (!tokenSnap.empty) {
      const tokenDoc = tokenSnap.docs[0];
      const tokenData = tokenDoc.data();
      if (tokenData.expiresAt.toDate() > new Date()) {
        resolvedFamilyId = tokenData.familyId;
        // Mark token used
        await tokenDoc.ref.update({ used: true, usedAt: FieldValue.serverTimestamp(), usedBy: email });
      }
    }
  }

  if (requestedFamilyId && !resolvedFamilyId) {
    resolvedFamilyId = requestedFamilyId;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = uuidv4();

  const userData = {
    email,
    displayName,
    password: hashedPassword,
    role,
    status: "pending",
    familyId: resolvedFamilyId,
    memberId: null,
    avatarUrl: null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection("users").doc(userId).set(userData);

  const user = {
    id: userId,
    email,
    displayName,
    avatarUrl: null,
    status: "pending" as const,
    role: role as "user",
    familyId: resolvedFamilyId,
    memberId: null,
    createdAt: new Date().toISOString(),
  };

  const token = signToken({ id: userId, email, displayName, role, status: "pending", familyId: resolvedFamilyId, memberId: null });

  await logAudit({ action: "user.register", userId, familyId: resolvedFamilyId ?? undefined, details: email });

  res.status(201).json({ user, token });
});

// POST /api/auth/login
router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password required" });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const valid = await bcrypt.compare(password, data.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = {
    id: doc.id,
    email: data.email,
    displayName: data.displayName,
    avatarUrl: data.avatarUrl ?? null,
    status: data.status,
    role: data.role,
    familyId: data.familyId ?? null,
    memberId: data.memberId ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };

  const token = signToken({ id: doc.id, email: data.email, displayName: data.displayName, role: data.role, status: data.status, familyId: data.familyId ?? null, memberId: data.memberId ?? null });

  await logAudit({ action: "user.login", userId: doc.id, familyId: data.familyId, ipAddress: req.ip });

  res.json({ user, token });
});

// POST /api/auth/logout
router.post("/auth/logout", (req: Request, res: Response): void => {
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getFirestore();
  const snap = await db.collection("users").doc(req.user!.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const data = snap.data()!;
  res.json({
    id: snap.id,
    email: data.email,
    displayName: data.displayName,
    avatarUrl: data.avatarUrl ?? null,
    status: data.status,
    role: data.role,
    familyId: data.familyId ?? null,
    memberId: data.memberId ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  });
});

// POST /api/auth/verify-invite
router.post("/auth/verify-invite", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("invite_tokens").where("token", "==", token).where("used", "==", false).limit(1).get();
  if (snap.empty) {
    res.json({ valid: false, familyId: "", familyName: "", email: null });
    return;
  }

  const tokenData = snap.docs[0].data();
  if (tokenData.expiresAt.toDate() < new Date()) {
    res.json({ valid: false, familyId: "", familyName: "", email: null });
    return;
  }

  // Get family name
  const familySnap = await db.collection("families").doc(tokenData.familyId).get();
  const familyName = familySnap.exists ? familySnap.data()!.name : "Unknown Family";

  res.json({ valid: true, familyId: tokenData.familyId, familyName, email: tokenData.email ?? null });
});

export default router;
