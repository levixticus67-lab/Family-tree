import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getFirestore, FieldValue } from "../lib/firebase";
import { requireAuth, requireActive, requireGatekeeper, requireFamilyAccess } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { getOpenAI } from "../lib/openai";
import type { Request, Response } from "express";

const router = Router();

function serializeFamily(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data.name,
    description: data.description ?? null,
    coverUrl: data.coverUrl ?? null,
    familyTreeId: data.familyTreeId,
    gatekeeperId: data.gatekeeperId,
    theme: data.theme ?? "heritage",
    memberCount: data.memberCount ?? 0,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

// POST /api/families
router.post("/families", requireAuth, requireActive, async (req: Request, res: Response): Promise<void> => {
  const { name, description, coverUrl, theme } = req.body;
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }

  const db = getFirestore();
  const familyId = uuidv4();
  const familyTreeId = uuidv4();

  const data = {
    name,
    description: description ?? null,
    coverUrl: coverUrl ?? null,
    familyTreeId,
    gatekeeperId: req.user!.id,
    theme: theme ?? "heritage",
    memberCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection("families").doc(familyId).set(data);

  // Assign gatekeeper role and familyId to creator
  await db.collection("users").doc(req.user!.id).update({
    role: "gatekeeper",
    familyId,
    status: "active",
  });

  await logAudit({ action: "family.create", userId: req.user!.id, familyId, details: name });

  res.status(201).json(serializeFamily(familyId, { ...data, createdAt: { toDate: () => new Date() } }));
});

// GET /api/families/:familyId
router.get("/families/:familyId", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const db = getFirestore();
  const snap = await db.collection("families").doc(req.params.familyId as string).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  res.json(serializeFamily(snap.id, snap.data()!));
});

// PATCH /api/families/:familyId
router.patch("/families/:familyId", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const db = getFirestore();
  const updates: Record<string, unknown> = {};
  for (const key of ["name", "description", "coverUrl", "theme"]) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  await db.collection("families").doc(req.params.familyId as string).update(updates);
  const snap = await db.collection("families").doc(req.params.familyId as string).get();
  res.json(serializeFamily(snap.id, snap.data()!));
});

// GET /api/families/:familyId/stats
router.get("/families/:familyId/stats", requireAuth, requireActive, requireFamilyAccess, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();

  const [membersSnap, postsSnap, mediaSnap] = await Promise.all([
    db.collection(`families/${familyId}/members`).get(),
    db.collection(`families/${familyId}/posts`).get(),
    db.collection(`families/${familyId}/media`).get(),
  ]);

  const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const living = members.filter((m: any) => !m.deathDate).length;

  // Detect today's birthdays
  const today = new Date();
  const todayMd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const birthdaysToday = members
    .filter((m: any) => {
      if (!m.birthDate) return false;
      const bd = new Date(m.birthDate);
      const mdStr = `${String(bd.getMonth() + 1).padStart(2, "0")}-${String(bd.getDate()).padStart(2, "0")}`;
      return mdStr === todayMd;
    })
    .map((m: any) => ({
      id: m.id,
      familyId,
      firstName: m.firstName,
      lastName: m.lastName,
      gender: m.gender ?? null,
      birthDate: m.birthDate ?? null,
      deathDate: m.deathDate ?? null,
      birthPlace: m.birthPlace ?? null,
      bio: m.bio ?? null,
      avatarUrl: m.avatarUrl ?? null,
      posX: m.posX ?? null,
      posY: m.posY ?? null,
      linkedUserId: m.linkedUserId ?? null,
      role: m.role ?? null,
      locationLat: m.locationLat ?? null,
      locationLng: m.locationLng ?? null,
      locationName: m.locationName ?? null,
      createdAt: m.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    }));

  // Rough generation count
  const generations = Math.max(1, Math.ceil(Math.log2(members.length + 1)));

  res.json({
    totalMembers: members.length,
    livingMembers: living,
    generations,
    totalPosts: postsSnap.size,
    totalMedia: mediaSnap.size,
    birthdaysToday,
  });
});

// POST /api/families/:familyId/invite
router.post("/families/:familyId/invite", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const { email, expiresInH = 72 } = req.body;
  const db = getFirestore();

  const token = uuidv4().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + expiresInH * 60 * 60 * 1000);

  await db.collection("invite_tokens").doc(token).set({
    token,
    familyId,
    email: email ?? null,
    used: false,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user!.id,
  });

  const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const url = `https://${baseUrl}/register?invite=${token}`;

  await logAudit({ action: "invite.create", userId: req.user!.id, familyId, details: email ?? "open" });

  res.json({ token, url, expiresAt: expiresAt.toISOString() });
});

// GET /api/families/:familyId/pending-members
router.get("/families/:familyId/pending-members", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const db = getFirestore();
  const snap = await db.collection("users").where("familyId", "==", familyId).where("status", "==", "pending").get();
  const users = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl ?? null,
      status: data.status,
      role: data.role,
      familyId: data.familyId ?? null,
      memberId: data.memberId ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  });
  res.json(users);
});

// POST /api/families/:familyId/pending-members/:userId/approve
router.post("/families/:familyId/pending-members/:userId/approve", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string; const userId = req.params.userId as string;
  const db = getFirestore();
  await db.collection("users").doc(userId).update({ status: "active" });
  // Update family memberCount
  await db.collection("families").doc(familyId).update({ memberCount: FieldValue.increment(1) });

  const snap = await db.collection("users").doc(userId).get();
  const data = snap.data()!;
  await logAudit({ action: "member.approve", userId: req.user!.id, familyId, details: userId });

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

// POST /api/families/:familyId/pending-members/:userId/reject
router.post("/families/:familyId/pending-members/:userId/reject", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const db = getFirestore();
  await db.collection("users").doc(userId).update({ status: "suspended" });
  await logAudit({ action: "member.reject", userId: req.user!.id, familyId: req.params.familyId as string, details: userId });
  res.json({ success: true });
});

// POST /api/families/:familyId/chronicle  — AI-generated family chronicle
router.post("/families/:familyId/chronicle", requireAuth, requireActive, requireFamilyAccess, requireGatekeeper, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.params.familyId as string;
  const jobId = uuidv4();
  const db = getFirestore();

  await db.collection("chronicle_jobs").doc(jobId).set({
    familyId,
    status: "processing",
    createdAt: FieldValue.serverTimestamp(),
    requestedBy: req.user!.id,
  });

  const [familyDoc, membersSnap, postsSnap, eventsSnap] = await Promise.all([
    db.collection("families").doc(familyId).get(),
    db.collection(`families/${familyId}/members`).get(),
    db.collection(`families/${familyId}/posts`).orderBy("createdAt", "desc").limit(30).get(),
    db.collection(`families/${familyId}/events`).orderBy("startDate", "asc").limit(20).get(),
  ]);

  const family = familyDoc.data();
  const members = membersSnap.docs.map(d => d.data());
  const posts = postsSnap.docs.map(d => d.data());
  const events = eventsSnap.docs.map(d => d.data());

  const memberList = members.map((m: any) =>
    `- ${m.firstName ?? ""} ${m.lastName ?? ""}${m.birthDate ? ` (born ${m.birthDate})` : ""}${m.isDeceased ? " †" : ""}${m.bio ? `: ${m.bio.slice(0, 120)}` : ""}`
  ).join("\n") || "No members added yet.";

  const eventList = events.slice(0, 10).map((e: any) =>
    `- ${e.title}${e.startDate ? ` (${e.startDate})` : ""}${e.description ? `: ${e.description.slice(0, 100)}` : ""}`
  ).join("\n") || "No events recorded yet.";

  const postExcerpts = posts.slice(0, 10).map((p: any) =>
    `- "${(p.content ?? "").slice(0, 180)}"`
  ).join("\n") || "No memories shared yet.";

  const familyName = family?.name ?? "Our Family";

  let content = `<h1>${familyName}</h1><p>A family chronicle.</p>`;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a gifted family historian. Write warm, eloquent narrative chronicles in clean HTML using only h1, h2, p, ul, li tags. Do not use markdown."
        },
        {
          role: "user",
          content: `Write a beautiful family chronicle for the "${familyName}" family using this data:

MEMBERS:
${memberList}

EVENTS & MILESTONES:
${eventList}

RECENT MEMORIES:
${postExcerpts}

Structure:
1. <h1> with the family name and a subtitle
2. <h2>Our People</h2> — warm vignettes for each member
3. <h2>Milestones & Gatherings</h2> — narrative about the events
4. <h2>Voices & Memories</h2> — weave in highlights from shared posts
5. <h2>A Closing Reflection</h2> — a heartfelt paragraph about what this family means

Write 600–900 words. Be specific, warm, and personal.`
        }
      ],
      max_tokens: 1400,
    });
    content = completion.choices[0]?.message?.content?.trim() ?? content;
  } catch (err) {
    req.log.warn({ err }, "OpenAI chronicle generation failed, using fallback");
  }

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${familyName} — Family Chronicle</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;max-width:820px;margin:0 auto;padding:3rem 2rem;line-height:1.85;color:#2c2319;background:#fdfaf5}
    h1{font-size:2.6rem;color:#4a3728;border-bottom:3px solid #c8a87a;padding-bottom:.6rem;margin-bottom:.4rem}
    h1+p{color:#7a6452;font-size:1.05rem;margin-top:0;margin-bottom:2rem}
    h2{font-size:1.4rem;color:#6b4f35;margin-top:2.5rem;margin-bottom:.8rem;font-variant:small-caps;letter-spacing:.04em}
    p{margin-bottom:1.1rem}
    ul{padding-left:1.6rem}
    li{margin-bottom:.5rem}
    hr{border:none;border-top:1px solid #d9c9b0;margin:3rem 0}
    footer{text-align:center;color:#b0a090;font-size:.82rem}
    @media print{body{background:#fff;padding:1.5rem}}
    @media(max-width:600px){body{padding:1.5rem 1rem}h1{font-size:1.8rem}}
  </style>
</head>
<body>
${content}
<hr>
<footer>Generated by Sanctuary &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</footer>
</body>
</html>`;

  await db.collection("chronicle_jobs").doc(jobId).update({
    status: "completed",
    completedAt: FieldValue.serverTimestamp(),
  });

  await logAudit({ action: "family.chronicle", userId: req.user!.id, familyId, details: jobId });

  res.json({ jobId, status: "completed", html: htmlDoc });
});

export default router;
