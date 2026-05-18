import { getFirestore, FieldValue } from "./firebase";
import { v4 as uuidv4 } from "uuid";

export async function logAudit(params: {
  action: string;
  userId?: string;
  familyId?: string;
  ipAddress?: string;
  details?: string;
}): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection("audit_logs").doc(uuidv4()).set({
      ...params,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {
    // Audit failures must never crash the main flow
  }
}
