import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase/server";
import { prisma } from "./prisma";

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
  user: User;
  organizationId: string;
  storeId: string;
  role: string;
};

function createStoreName(user: User) {
  const emailName = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return emailName ? `${emailName} Store` : "Clothing Store";
}

export async function requireActiveStore(): Promise<ActiveStoreContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthRequiredError();
  }

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" }
  });

  if (existingMembership) {
    return {
      user,
      organizationId: existingMembership.organizationId,
      storeId: existingMembership.storeId,
      role: existingMembership.role
    };
  }

  const createdMembership = await prisma.$transaction(async (tx) => {
    const membershipCount = await tx.membership.count();
    const legacyStore = await tx.store.findUnique({
      where: { id: "legacy_store_default" }
    });

    if (membershipCount === 0 && legacyStore) {
      return tx.membership.create({
        data: {
          organizationId: legacyStore.organizationId,
          storeId: legacyStore.id,
          userId: user.id,
          email: user.email,
          role: "owner"
        }
      });
    }

    const storeName = createStoreName(user);
    const organization = await tx.organization.create({
      data: {
        name: storeName,
        stores: {
          create: {
            name: storeName,
            phone: user.phone || null
          }
        }
      },
      include: {
        stores: true
      }
    });

    const store = organization.stores[0];
    if (!store) {
      throw new TenantSetupError("Unable to create store.");
    }

    return tx.membership.create({
      data: {
        organizationId: organization.id,
        storeId: store.id,
        userId: user.id,
        email: user.email,
        role: "owner"
      }
    });
  });

  return {
    user,
    organizationId: createdMembership.organizationId,
    storeId: createdMembership.storeId,
    role: createdMembership.role
  };
}

export function getTenantErrorStatus(error: unknown, fallback = 500) {
  if (error instanceof AuthRequiredError || error instanceof TenantSetupError) {
    return error.status;
  }

  return fallback;
}
