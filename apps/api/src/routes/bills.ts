import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { calculateCheckout } from "../lib/billing.js";

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

const tenantHeadersSchema = z.object({
  "x-organization-id": z.string().min(1),
  "x-store-id": z.string().min(1),
  "x-user-id": z.string().optional()
});

function getTenant(headers: unknown) {
  return tenantHeadersSchema.parse(headers);
}

function mapBill(bill: any) {
  return {
    id: bill.id,
    totalAmount: Number(bill.totalAmount),
    discountAmount: Number(bill.discountAmount),
    taxAmount: Number(bill.taxAmount),
    finalAmount: Number(bill.finalAmount),
    paymentMethod: bill.paymentMethod,
    createdAt: bill.createdAt?.toDate ? bill.createdAt.toDate() : bill.createdAt,
    customerName: bill.customerName ?? undefined,
    customerPhone: bill.customerPhone ?? undefined,
    billDiscountPercent: Number(bill.billDiscountPercent || 0),
    billManualDiscountAmount: Number(bill.billManualDiscountAmount || 0),
    items: bill.items?.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      tax: Number(item.tax),
      total: Number(item.total),
      productName: item.productName
    })) ?? []
  };
}

const billRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenant = getTenant(request.headers);

    const snapshot = await fastify.db.collection("bills")
      .where("storeId", "==", tenant["x-store-id"])
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map(d => mapBill(d.data()));
  });

  fastify.get("/:id", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const billDoc = await fastify.db.collection("bills").doc(params.id).get();

    if (!billDoc.exists || billDoc.data()?.storeId !== tenant["x-store-id"]) {
      return reply.code(404).send({ message: "Bill not found" });
    }

    return mapBill(billDoc.data());
  });

  fastify.post("/", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const body = checkoutSchema.parse(request.body);

    const summary = calculateCheckout(
      body.items,
      body.billDiscountPercent,
      body.billManualDiscountAmount
    );

    const billRef = fastify.db.collection("bills").doc();
    const createdBillData: Record<string, any> = {};

    await fastify.db.runTransaction(async (tx) => {
      // Read all products
      const productRefs = body.items.map(item => fastify.db.collection("products").doc(item.productId));
      const productDocs = await Promise.all(productRefs.map(ref => tx.get(ref)));

      const productMap = new Map();
      for (const doc of productDocs) {
        if (!doc.exists) throw new Error(`Product missing: ${doc.id}`);
        productMap.set(doc.id, doc.data());
      }

      for (const item of body.items) {
        const product = productMap.get(item.productId);
        if (product.stock < item.quantity) throw new Error(`Not enough stock for ${product.name}`);
      }

      let customerRef = null;
      let customerDoc = null;

      if (body.paymentMethod === "credit" && body.customerPhone) {
        const customerQuery = await fastify.db.collection("customers")
          .where("storeId", "==", tenant["x-store-id"])
          .where("phone", "==", body.customerPhone)
          .limit(1)
          .get();

        if (!customerQuery.empty) {
          customerRef = customerQuery.docs[0].ref;
          customerDoc = await tx.get(customerRef);
        } else if (body.customerName) {
          customerRef = fastify.db.collection("customers").doc();
        }
      }

      Object.assign(createdBillData, {
        id: billRef.id,
        organizationId: tenant["x-organization-id"],
        storeId: tenant["x-store-id"],
        cashierUserId: tenant["x-user-id"] ?? null,
        totalAmount: summary.totalAmount,
        discountAmount: summary.discountAmount,
        taxAmount: summary.taxAmount,
        finalAmount: summary.finalAmount,
        billDiscountPercent: body.billDiscountPercent ?? 0,
        billManualDiscountAmount: body.billManualDiscountAmount ?? 0,
        paymentMethod: body.paymentMethod,
        customerName: body.customerName ?? null,
        customerPhone: body.customerPhone ?? null,
        status: "completed",
        items: summary.items.map(item => {
          const p = productMap.get(item.productId);
          return {
            id: fastify.db.collection("bills").doc().id,
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

      for (const item of summary.items) {
        const pRef = fastify.db.collection("products").doc(item.productId);
        const pData = productMap.get(item.productId);
        tx.update(pRef, { stock: pData.stock - item.quantity });
      }

      if (customerRef) {
        if (customerDoc && customerDoc.exists) {
          tx.update(customerRef, {
            balance: customerDoc.data()?.balance + summary.finalAmount,
            updatedAt: new Date()
          });
        } else if (body.customerName) {
          tx.set(customerRef, {
            id: customerRef.id,
            organizationId: tenant["x-organization-id"],
            storeId: tenant["x-store-id"],
            name: body.customerName,
            phone: body.customerPhone,
            balance: summary.finalAmount,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        const ledgerRef = fastify.db.collection("ledgerEntries").doc();
        tx.set(ledgerRef, {
          id: ledgerRef.id,
          organizationId: tenant["x-organization-id"],
          storeId: tenant["x-store-id"],
          customerId: customerRef.id,
          amount: summary.finalAmount,
          type: "credit",
          note: `Bill #${createdBillData.id.slice(-6).toUpperCase()}`,
          date: new Date(),
          createdAt: new Date()
        });
      }
    });

    return reply.code(201).send({ ...mapBill(createdBillData), summary });
  });
};

export default billRoutes;
