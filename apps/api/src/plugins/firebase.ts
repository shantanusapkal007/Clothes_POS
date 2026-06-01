import fp from "fastify-plugin";
import admin from "firebase-admin";

declare module "fastify" {
  interface FastifyInstance {
    firebase: admin.app.App;
    db: admin.firestore.Firestore;
    adminAuth: admin.auth.Auth;
  }
}

import fs from "fs";
import path from "path";

let firebaseApp: admin.app.App;

if (!admin.apps.length) {
  try {
    let serviceAccount;

    // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY env string
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      serviceAccount = JSON.parse(serviceAccountKey);
    }
    // 2. Try GOOGLE_APPLICATION_CREDENTIALS path (normalize backslashes)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const cleanPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.replace(/\\\\/g, "\\");
        const resolvedPath = path.resolve(cleanPath);
        if (fs.existsSync(resolvedPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
        }
      } catch (e) {
        console.warn("Failed to read GOOGLE_APPLICATION_CREDENTIALS file in API:", e);
      }
    }

    // 3. Fallback: scan known relative paths inside this workspace monorepo
    if (!serviceAccount) {
      const searchPaths = [
        path.join(process.cwd(), "serviceAccountKey.json"),
        path.join(process.cwd(), "..", "serviceAccountKey.json"),
        path.join(process.cwd(), "..", "..", "serviceAccountKey.json"),
        "e:\\projects\\friends\\serviceAccountKey.json",
      ];
      for (const p of searchPaths) {
        try {
          if (fs.existsSync(p)) {
            serviceAccount = JSON.parse(fs.readFileSync(p, "utf8"));
            break;
          }
        } catch {}
      }
    }

    if (serviceAccount) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "clothes-94ef3"
      });
    } else {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "clothes-94ef3"
      });
    }
  } catch (error) {
    console.error("Firebase admin initialization error", error);
    throw error;
  }
} else {
  firebaseApp = admin.apps[0]!;
}

export default fp(async (fastify) => {
  const db = admin.firestore(firebaseApp);
  const adminAuth = admin.auth(firebaseApp);

  fastify.decorate("firebase", firebaseApp);
  fastify.decorate("db", db);
  fastify.decorate("adminAuth", adminAuth);
});
