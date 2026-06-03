import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateCheckout } from "../../../lib/billing";
import { getApiErrorStatus, getErrorMessage } from "../../../lib/errors";
import { mapBill } from "../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";
import { adminDb } from "../../../lib/firebase/server";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  paymentMethod: z.string().min(1),
  billDiscountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  billManualDiscountAmount: z.coerce.number().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        price: z.coerce.number().min(0),
        discountPercent: z.coerce.number().min(0),
        manualDiscountAmount: z.coerce.number().min(0).default(0),
        taxPercent: z.coerce.number().min(0)
      })
    )
    .min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const search = url.searchParams.get("search")?.trim().toLowerCase() || "";
    
    // In NoSQL, doing complex ranges + sorting + filtering is limited.
    // For this migration, we fetch recent bills and filter in memory.
    const snapshot = await adminDb.collection("bills")
      .where("storeId", "==", tenant.storeId)
      .get();
    
    let bills = snapshot.docs.map(doc => doc.data());

    // Sort descending by createdAt in-memory
    bills.sort((a, b) => {
      const t1 = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const t2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return t2 - t1;
    });

    // Limit to top 200
    bills = bills.slice(0, 200);

    if (search) {
      bills = bills.filter(b => 
        b.id.toLowerCase().includes(search) || 
        (b.customerName && b.customerName.toLowerCase().includes(search)) ||
        (b.customerPhone && b.customerPhone.toLowerCase().includes(search))
      );
    }

    const total = bills.length;
    const skip = (page - 1) * limit;
    const paginatedBills = bills.slice(skip, skip + limit);

    return NextResponse.json({
      bills: paginatedBills.map(mapBill),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load bills");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const body = checkoutSchema.parse(await request.json());
    
    const summary = calculateCheckout(
      body.items,
      body.billDiscountPercent,
      body.billManualDiscountAmount
    );

    const billRef = adminDb.collection("bills").doc();
    const createdBillData: Record<string, any> = {};

    await adminDb.runTransaction(async (tx) => {
      // Reads
      const productRefs = body.items.map(item => adminDb.collection("products").doc(item.productId));
      const productDocs = await Promise.all(productRefs.map(ref => tx.get(ref)));
      
      const productMap = new Map();
      for (const doc of productDocs) {
        if (!doc.exists) {
          throw new Error(`Product missing: ${doc.id}`);
        }
        productMap.set(doc.id, doc.data());
      }

      for (const item of body.items) {
        const product = productMap.get(item.productId);
        if (product.stock < item.quantity) {
          throw new Error(`Not enough stock for ${product.name}`);
        }
      }

      let customerRef = null;
      let customerDoc = null;

      if (body.paymentMethod === "credit" && body.customerPhone) {
        const customerQuery = await adminDb.collection("customers")
          .where("storeId", "==", tenant.storeId)
          .where("phone", "==", body.customerPhone)
          .limit(1)
          .get();
          
        if (!customerQuery.empty) {
          customerRef = customerQuery.docs[0].ref;
          customerDoc = await tx.get(customerRef);
        } else if (body.customerName) {
          customerRef = adminDb.collection("customers").doc();
        }
      }

      // Writes
      Object.assign(createdBillData, {
        id: billRef.id,
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        cashierUserId: tenant.user.uid,
        totalAmount: summary.totalAmount,
        discountAmount: summary.discountAmount,
        taxAmount: summary.taxAmount,
        finalAmount: summary.finalAmount,
        billDiscountPercent: body.billDiscountPercent,
        billManualDiscountAmount: body.billManualDiscountAmount,
        paymentMethod: body.paymentMethod,
        customerName: body.customerName || null,
        customerPhone: body.customerPhone || null,
        status: "completed",
        items: summary.items.map(item => {
          const p = productMap.get(item.productId);
          return {
            id: adminDb.collection("bills").doc().id, // Random ID for item
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            costPrice: p.costPrice,
            discount: item.discountAmount,
            tax: item.taxAmount,
            total: item.total,
            productName: p.name
          };
        }),
        createdAt: new Date()
      });

      tx.set(billRef, createdBillData);

      // Stock updates
      for (const item of summary.items) {
        const pRef = adminDb.collection("products").doc(item.productId);
        const pData = productMap.get(item.productId);
        tx.update(pRef, { stock: pData.stock - item.quantity });
      }

      // Customer / Khata updates
      if (customerRef) {
        if (customerDoc && customerDoc.exists) {
          tx.update(customerRef, {
            balance: customerDoc.data()?.balance + summary.finalAmount,
            updatedAt: new Date()
          });
        } else if (body.customerName) {
          tx.set(customerRef, {
            id: customerRef.id,
            organizationId: tenant.organizationId,
            storeId: tenant.storeId,
            name: body.customerName,
            phone: body.customerPhone,
            balance: summary.finalAmount,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        const ledgerRef = adminDb.collection("ledgerEntries").doc();
        tx.set(ledgerRef, {
          id: ledgerRef.id,
          organizationId: tenant.organizationId,
          storeId: tenant.storeId,
          customerId: customerRef.id,
          amount: summary.finalAmount,
          type: "credit",
          note: `Bill #${createdBillData.id.slice(-6)}`,
          date: new Date(),
          createdAt: new Date()
        });
      }
    });

    return NextResponse.json(
      {
        ...mapBill(createdBillData),
        summary
      },
      { status: 201 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Unable to save bill");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, getApiErrorStatus(error, 400)) });
  }
}
