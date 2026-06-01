import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  try {
    let serviceAccount;

    // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY JSON string env
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      serviceAccount = JSON.parse(serviceAccountKey);
    } 
    // 2. Try GOOGLE_APPLICATION_CREDENTIALS path (normalize Windows backslashes)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const cleanPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.replace(/\\\\/g, '\\');
        const resolvedPath = path.resolve(cleanPath);
        if (fs.existsSync(resolvedPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        }
      } catch (e) {
        console.warn('Failed to read GOOGLE_APPLICATION_CREDENTIALS file:', e);
      }
    }

    // 3. Fallback: scan known relative paths inside this workspace monorepo
    if (!serviceAccount) {
      const searchPaths = [
        path.join(process.cwd(), 'serviceAccountKey.json'),
        path.join(process.cwd(), '..', '..', 'serviceAccountKey.json'),
        'e:\\projects\\friends\\serviceAccountKey.json',
      ];
      for (const p of searchPaths) {
        try {
          if (fs.existsSync(p)) {
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            break;
          }
        } catch {}
      }
    }

    if (serviceAccount) {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'clothes-94ef3'
      });
    } else {
      // Fallback to standard Application Default Credentials
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
