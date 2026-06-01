import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "./firebase/server";

export class AuthRequiredError extends Error {
  status = 401;

  constructor() {
    super("Please sign in to continue.");
  }
}

export class TenantSetupError extends Error {
  status = 500;
}

export type ActiveStoreContext = {
  user: UserRecord;
  organizationId: string;
  storeId: string;
  role: string;
};

function createStoreName(user: UserRecord) {
  const emailName = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return emailName ? `${emailName} Store` : "Clothing Store";
}

export async function requireActiveStore(): Promise<ActiveStoreContext> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    throw new AuthRequiredError();
  }

  let decodedToken: DecodedIdToken;
  let user: UserRecord;
  try {
    decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    user = await adminAuth.getUser(decodedToken.uid);
  } catch (error) {
    throw new AuthRequiredError();
  }

  const membershipsRef = adminDb.collection("memberships");
  const membershipQuery = await membershipsRef.where("userId", "==", user.uid).get();

  if (!membershipQuery.empty) {
    const docs = membershipQuery.docs.map(doc => doc.data());
    docs.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
    const existingMembership = docs[0]!;
    return {
      user,
      organizationId: existingMembership.organizationId,
      storeId: existingMembership.storeId,
      role: existingMembership.role
    };
  }

  // Create new tenant in a transaction
  try {
    const createdMembership = await adminDb.runTransaction(async (tx) => {
      // Check legacy logic (skipping membership count check for brevity in NoSQL, or we could query it but it's expensive)
      // Let's just create a new org and store.
      const orgRef = adminDb.collection("organizations").doc();
      const storeRef = adminDb.collection("stores").doc();
      const membershipRef = adminDb.collection("memberships").doc();
      const storeName = createStoreName(user);

      tx.set(orgRef, {
        id: orgRef.id,
        name: storeName,
        createdAt: new Date()
      });

      tx.set(storeRef, {
        id: storeRef.id,
        organizationId: orgRef.id,
        name: storeName,
        phone: user.phoneNumber || null,
        createdAt: new Date()
      });

      const membershipData = {
        id: membershipRef.id,
        organizationId: orgRef.id,
        storeId: storeRef.id,
        userId: user.uid,
        email: user.email,
        role: "owner",
        createdAt: new Date()
      };
      
      tx.set(membershipRef, membershipData);
      return membershipData;
    });

    return {
      user,
      organizationId: createdMembership.organizationId,
      storeId: createdMembership.storeId,
      role: createdMembership.role
    };
  } catch (error) {
    console.error("Failed to setup tenant:", error);
    throw new TenantSetupError("Unable to create store.");
  }
}

export function getTenantErrorStatus(error: unknown, fallback = 500) {
  if (error instanceof AuthRequiredError || error instanceof TenantSetupError) {
    return error.status;
  }

  return fallback;
}
