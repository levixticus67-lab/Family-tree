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

  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  let resolvedFamilyId: string | null = null;
  let role = "user";

  if (inviteToken) {
    const tokenSnap = await db.collection("invite_tokens").where("token", "==", inviteToken).where("used", "==", false).limit(1).get();
    if (!tokenSnap.empty) {
      const tokenDoc = tokenSnap.docs[0];
      const tokenData = tokenDoc.data();
      if (tokenData.expiresAt.toDate() > new Date()) {
        resolvedFamilyId = tokenData.familyId;
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

// POST /api/auth/register-family — Creates a user + their own family in one step
router.post("/auth/register-family", async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName, familyName } = req.body;

  if (!email || !password || !displayName || !familyName) {
    res.status(400).json({ error: "email, password, displayName, and familyName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if ((familyName as string).trim().length < 2) {
    res.status(400).json({ error: "Family name must be at least 2 characters" });
    return;
  }

  const db = getFirestore();

  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    res.status(400).json({ error: "This email address is already registered" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const familyId = uuidv4();
  const familyTreeId = uuidv4();

  // Create family
  await db.collection("families").doc(familyId).set({
    name: (familyName as string).trim(),
    description: null,
    coverUrl: null,
    familyTreeId,
    gatekeeperId: userId,
    theme: "heritage",
    memberCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Create user as gatekeeper, already active
  await db.collection("users").doc(userId).set({
    email,
    displayName: (displayName as string).trim(),
    password: hashedPassword,
    role: "gatekeeper",
    status: "active",
    familyId,
    memberId: null,
    avatarUrl: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  const user = {
    id: userId,
    email,
    displayName: (displayName as string).trim(),
    avatarUrl: null,
    status: "active" as const,
    role: "gatekeeper" as const,
    familyId,
    memberId: null,
    createdAt: new Date().toISOString(),
  };

  const token = signToken({
    id: userId,
    email,
    displayName: (displayName as string).trim(),
    role: "gatekeeper",
    status: "active",
    familyId,
    memberId: null,
  });

  await logAudit({ action: "family.create", userId, familyId, details: (familyName as string).trim() });
  await logAudit({ action: "user.register", userId, familyId, details: email });

  res.status(201).json({ user, token, familyId });
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
router.post("/auth/logout", (_req: Request, res: Response): void => {
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

  const familySnap = await db.collection("families").doc(tokenData.familyId).get();
  const familyName = familySnap.exists ? familySnap.data()!.name : "Unknown Family";

  res.json({ valid: true, familyId: tokenData.familyId, familyName, email: tokenData.email ?? null });
});

export default router;
