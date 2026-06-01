import admin from 'firebase-admin';

function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Option 1: Use GOOGLE_APPLICATION_CREDENTIALS env (path to JSON file)
  // Option 2: Use FIREBASE_SERVICE_ACCOUNT_KEY env (JSON string)
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  try {
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'clothes-94ef3'
      });
    } else {
      // Falls back to GOOGLE_APPLICATION_CREDENTIALS or ADC (works on Google Cloud)
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'clothes-94ef3'
      });
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    throw error;
  }
}

const app = initFirebase();
const adminDb = admin.firestore(app);
const adminAuth = admin.auth(app);

export { adminDb, adminAuth };
