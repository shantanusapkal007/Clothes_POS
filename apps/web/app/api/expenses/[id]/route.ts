import { NextRequest, NextResponse } from "next/server";
import { assertDatabaseConfig } from "../../../../lib/database-url";
import { getErrorMessage } from "../../../../lib/errors";
import { prisma } from "../../../../lib/prisma";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const resolvedParams = await params;

    // Ensure the expense belongs to the current store
    await prisma.expense.delete({
      where: {
        id: resolvedParams.id,
        storeId: tenant.storeId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to delete expense");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
