import { Decimal } from "@prisma/client/runtime/library";
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
import type { FastifyRequest, FastifyInstance } from "fastify";

const tenantHeadersSchema = z.object({
  "x-store-id": z.string().min(1)
});

async function getTenant(request: FastifyRequest, fastify: FastifyInstance) {
  const headers = tenantHeadersSchema.parse(request.headers);
  const storeId = headers["x-store-id"];
  const user = request.user;

  if (!user || !user.sub) {
    throw fastify.httpErrors.unauthorized("Authentication required");
  }

  const membership = await fastify.prisma.membership.findFirst({
    where: { userId: user.sub, storeId }
  });

  if (!membership) {
    throw fastify.httpErrors.forbidden("User is not a member of this store");
  }

  return {
    "x-organization-id": membership.organizationId,
    "x-store-id": membership.storeId,
    "x-user-id": membership.userId
  };
}

const mapProduct = (product: {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  price: Decimal;
  costPrice: Decimal;
  discountPercent: Decimal;
  taxPercent: Decimal;
  stock: number;
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
}) => ({
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
  createdAt: product.createdAt,
  updatedAt: product.updatedAt
});

const productRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get("/", async (request) => {
    const tenant = await getTenant(request, fastify);
    const query = z
      .object({
        search: z.string().trim().optional()
      })
      .parse(request.query);

    const where = query.search
      ? {
          storeId: tenant["x-store-id"],
          OR: [
            {
              name: {
                contains: query.search,
                mode: "insensitive" as const
              }
            },
            {
              category: {
                contains: query.search,
                mode: "insensitive" as const
              }
            },
            {
              barcode: {
                contains: query.search,
                mode: "insensitive" as const
              }
            }
          ]
        }
      : undefined;

    const products = await fastify.prisma.product.findMany({
      where: where ?? { storeId: tenant["x-store-id"] },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return products.map(mapProduct);
  });

  fastify.get("/barcode/:code", async (request, reply) => {
    const tenant = await getTenant(request, fastify);
    const params = z.object({ code: z.string().min(1) }).parse(request.params);
    const product = await fastify.prisma.product.findFirst({
      where: {
        storeId: tenant["x-store-id"],
        barcode: params.code
      }
    });

    if (!product) {
      return reply.code(404).send({ message: "Product not found" });
    }

    return mapProduct(product);
  });

  fastify.post("/", async (request, reply) => {
    const tenant = await getTenant(request, fastify);
    const body = productSchema.parse(request.body);
    const product = await fastify.prisma.product.create({
      data: {
        organizationId: tenant["x-organization-id"],
        storeId: tenant["x-store-id"],
        name: body.name,
        category: body.category ?? null,
        barcode: body.barcode || null,
        price: new Decimal(body.price),
        costPrice: new Decimal(body.costPrice),
        discountPercent: new Decimal(body.discountPercent),
        taxPercent: new Decimal(body.taxPercent),
        stock: body.stock,
        minStock: body.minStock
      }
    });

    return reply.code(201).send(mapProduct(product));
  });

  fastify.put("/:id", async (request) => {
    const tenant = await getTenant(request, fastify);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = productUpdateSchema.parse(request.body);
    const existing = await fastify.prisma.product.findFirst({
      where: {
        id: params.id,
        storeId: tenant["x-store-id"]
      }
    });

    if (!existing) {
      throw fastify.httpErrors.notFound("Product not found");
    }

    const product = await fastify.prisma.product.update({
      where: { id: params.id },
      data: {
        name: body.name,
        category: body.category === undefined ? undefined : body.category ?? null,
        barcode: body.barcode === undefined ? undefined : body.barcode || null,
        price: body.price === undefined ? undefined : new Decimal(body.price),
        costPrice: body.costPrice === undefined ? undefined : new Decimal(body.costPrice),
        discountPercent:
          body.discountPercent === undefined ? undefined : new Decimal(body.discountPercent),
        taxPercent: body.taxPercent === undefined ? undefined : new Decimal(body.taxPercent),
        stock: body.stock,
        minStock: body.minStock
      }
    });

    return mapProduct(product);
  });

  fastify.delete("/:id", async (request, reply) => {
    const tenant = await getTenant(request, fastify);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await fastify.prisma.product.deleteMany({
      where: {
        id: params.id,
        storeId: tenant["x-store-id"]
      }
    });

    if (deleted.count === 0) {
      return reply.code(404).send({ message: "Product not found" });
    }

    return reply.code(204).send();
  });
};

export default productRoutes;
