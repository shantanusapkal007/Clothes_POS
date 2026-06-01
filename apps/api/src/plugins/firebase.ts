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

function parseResilient(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    // Escape actual raw newlines that got unescaped during environment loading,
    // and restore double-escaped newlines for JSON compliance.
    const cleaned = input
      .replace(/\r?\n/g, '\\n')
      .replace(/\\'/g, "'");
    return JSON.parse(cleaned);
  }
}

let firebaseApp: admin.app.App;

if (!admin.apps.length) {
  try {
    let serviceAccount;

    // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY env string
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      serviceAccount = parseResilient(serviceAccountKey);
    }
    // 2. Try GOOGLE_APPLICATION_CREDENTIALS path (normalize backslashes)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const cleanPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.replace(/\\\\/g, "\\");
        const resolvedPath = path.resolve(cleanPath);
        if (fs.existsSync(resolvedPath)) {
          serviceAccount = parseResilient(fs.readFileSync(resolvedPath, "utf8"));
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
            serviceAccount = parseResilient(fs.readFileSync(p, "utf8"));
            break;
          }
        } catch {}
      }
    }

    if (serviceAccount) {
      // Ensure the private key has correct physical newline characters instead of literal "\n" strings
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

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
