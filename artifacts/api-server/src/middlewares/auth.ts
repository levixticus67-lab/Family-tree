import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getFirestore } from "../lib/firebase";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "fallback-dev-secret-change-me";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  familyId: string | null;
  memberId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "30d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, SESSION_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireActive(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.status !== "active") {
    res.status(403).json({ error: "Account pending approval" });
    return;
  }
  next();
}

export function requireGatekeeper(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!["gatekeeper", "master_admin"].includes(req.user.role)) {
    res.status(403).json({ error: "Gatekeeper access required" });
    return;
  }
  next();
}

export function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "master_admin") {
    res.status(403).json({ error: "Master admin access required" });
    return;
  }
  next();
}

export function requireFamilyAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { familyId } = req.params;
  if (req.user.role !== "master_admin" && req.user.familyId !== familyId) {
    res.status(403).json({ error: "Access denied to this family" });
    return;
  }
  next();
}

export async function refreshUserToken(userId: string): Promise<AuthUser | null> {
  try {
    const db = getFirestore();
    const snap = await db.collection("users").doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      id: snap.id,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      status: data.status,
      familyId: data.familyId ?? null,
      memberId: data.memberId ?? null,
    };
  } catch {
    return null;
  }
}
