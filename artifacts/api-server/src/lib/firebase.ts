import admin from "firebase-admin";
import { logger } from "./logger";

let _db: admin.firestore.Firestore;
let _rtdb: admin.database.Database;

function initFirebase() {
  if (admin.apps.length > 0) return;

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountRaw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountRaw) as admin.ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }

  // Accept both FIREBASE_DATABASE_URL and the legacy VITE_FIREBASE_DATABASE_URL name
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ??
    process.env.VITE_FIREBASE_DATABASE_URL;

  if (!databaseURL) {
    throw new Error(
      "FIREBASE_DATABASE_URL is not set (also checked VITE_FIREBASE_DATABASE_URL)"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL,
  });

  logger.info("Firebase Admin initialized");
}

export function getFirestore(): admin.firestore.Firestore {
  initFirebase();
  if (!_db) _db = admin.firestore();
  return _db;
}

export function getRtdb(): admin.database.Database {
  initFirebase();
  if (!_rtdb) _rtdb = admin.database();
  return _rtdb;
}

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
