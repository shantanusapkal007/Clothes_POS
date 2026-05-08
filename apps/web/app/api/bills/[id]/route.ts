import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../../lib/database-url";
import { getErrorMessage } from "../../../../lib/errors";
import { prisma } from "../../../../lib/prisma";
import { mapBill } from "../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().min(1)
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const bill = await prisma.bill.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
      include: { items: true, refunds: true }
    });

    if (!bill) {
      return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    }

    return NextResponse.json(mapBill(bill));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load bill");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
