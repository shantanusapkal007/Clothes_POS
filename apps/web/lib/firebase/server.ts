import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

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

function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  try {
    let serviceAccount;

    // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY JSON string env
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      serviceAccount = parseResilient(serviceAccountKey);
    } 
    // 2. Try GOOGLE_APPLICATION_CREDENTIALS path (normalize Windows backslashes)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const cleanPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.replace(/\\\\/g, '\\');
        const resolvedPath = path.resolve(cleanPath);
        if (fs.existsSync(resolvedPath)) {
          serviceAccount = parseResilient(fs.readFileSync(resolvedPath, 'utf8'));
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
            serviceAccount = parseResilient(fs.readFileSync(p, 'utf8'));
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
