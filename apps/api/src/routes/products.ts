import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).default(0),
  discountPercent: z.coerce.number().min(0).default(0),
  taxPercent: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0)
});

const productUpdateSchema = productSchema.partial();
const tenantHeadersSchema = z.object({
  "x-organization-id": z.string().min(1),
  "x-store-id": z.string().min(1)
});

function getTenant(headers: unknown) {
  return tenantHeadersSchema.parse(headers);
}

function mapProduct(product: any) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    barcode: product.barcode,
    price: Number(product.price),
    costPrice: Number(product.costPrice),
    discountPercent: Number(product.discountPercent),
    taxPercent: Number(product.taxPercent),
    stock: product.stock,
    minStock: product.minStock,
    createdAt: product.createdAt?.toDate ? product.createdAt.toDate() : product.createdAt,
    updatedAt: product.updatedAt?.toDate ? product.updatedAt.toDate() : product.updatedAt
  };
}

const productRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenant = getTenant(request.headers);
    const query = z.object({ search: z.string().trim().optional() }).parse(request.query);
    const search = query.search?.toLowerCase();

    const snapshot = await fastify.db.collection("products")
      .where("storeId", "==", tenant["x-store-id"])
      .get();

    let products = snapshot.docs.map(d => d.data());
    products.sort((a, b) => b.updatedAt?.toDate() - a.updatedAt?.toDate());

    if (search) {
      products = products.filter(p =>
        p.name?.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search) ||
        p.barcode?.toLowerCase().includes(search)
      );
    }

    return products.map(mapProduct);
  });

  fastify.get("/barcode/:code", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const params = z.object({ code: z.string().min(1) }).parse(request.params);

    const snapshot = await fastify.db.collection("products")
      .where("storeId", "==", tenant["x-store-id"])
      .where("barcode", "==", params.code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return reply.code(404).send({ message: "Product not found" });
    }

    return mapProduct(snapshot.docs[0].data());
  });

  fastify.post("/", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const body = productSchema.parse(request.body);
    const productRef = fastify.db.collection("products").doc();
    const newProduct = {
      id: productRef.id,
      organizationId: tenant["x-organization-id"],
      storeId: tenant["x-store-id"],
      name: body.name,
      category: body.category ?? null,
      barcode: body.barcode || null,
      price: body.price,
      costPrice: body.costPrice,
      discountPercent: body.discountPercent,
      taxPercent: body.taxPercent,
      stock: body.stock,
      minStock: body.minStock,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await productRef.set(newProduct);
    return reply.code(201).send(mapProduct(newProduct));
  });

  fastify.put("/:id", async (request) => {
    const tenant = getTenant(request.headers);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = productUpdateSchema.parse(request.body);

    const productRef = fastify.db.collection("products").doc(params.id);
    const existing = await productRef.get();

    if (!existing.exists || existing.data()?.storeId !== tenant["x-store-id"]) {
      throw fastify.httpErrors.notFound("Product not found");
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category ?? null;
    if (body.barcode !== undefined) updates.barcode = body.barcode || null;
    if (body.price !== undefined) updates.price = body.price;
    if (body.costPrice !== undefined) updates.costPrice = body.costPrice;
    if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
    if (body.taxPercent !== undefined) updates.taxPercent = body.taxPercent;
    if (body.stock !== undefined) updates.stock = body.stock;
    if (body.minStock !== undefined) updates.minStock = body.minStock;

    await productRef.update(updates);
    const updated = await productRef.get();
    return mapProduct(updated.data());
  });

  fastify.delete("/:id", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const productRef = fastify.db.collection("products").doc(params.id);
    const existing = await productRef.get();

    if (!existing.exists || existing.data()?.storeId !== tenant["x-store-id"]) {
      return reply.code(404).send({ message: "Product not found" });
    }

    await productRef.delete();
    return reply.code(204).send();
  });
};

export default productRoutes;
