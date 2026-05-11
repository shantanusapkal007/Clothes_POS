import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireActiveStore } from "../../../lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    const suppliers = await prisma.supplier.findMany({
      where: {
        storeId: tenant.storeId,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } }
          ]
        } : {})
      },
      orderBy: { name: "asc" },
      include: {
        purchases: {
          orderBy: { createdAt: "desc" },
          take: 10
        }
      }
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("GET Suppliers Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();

    const body = await request.json();
    const { name, phone, email, address, balance } = body;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        name,
        phone,
        email,
        address,
        balance: balance || 0
      }
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("POST Supplier Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
