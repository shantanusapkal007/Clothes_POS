import fp from "fastify-plugin";
import admin from "firebase-admin";

declare module "fastify" {
  interface FastifyInstance {
    firebase: admin.app.App;
    db: admin.firestore.Firestore;
    adminAuth: admin.auth.Auth;
  }
}

let firebaseApp: admin.app.App;

if (!admin.apps.length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
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
