import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import firebasePlugin from "./plugins/firebase.js";
import productRoutes from "./routes/products.js";
import billRoutes from "./routes/bills.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: true
  });
  app.register(sensible);
  app.register(firebasePlugin);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error instanceof ZodError) {
      return reply.code(422).send({
        message: error.issues
          .map((issue) => {
            const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
            return `${path}${issue.message}`;
          })
          .join("; ")
      });
    }

    const rawStatusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : undefined;
    const statusCode = rawStatusCode && rawStatusCode >= 400 ? rawStatusCode : 500;
    const message = error instanceof Error ? error.message : "Unexpected server error";

    return reply.code(statusCode).send({
      message: statusCode >= 500 ? "Unexpected server error" : message
    });
  });

  app.get("/health", async () => ({
    status: "ok"
  }));

  app.register(productRoutes, { prefix: "/products" });
  app.register(billRoutes, { prefix: "/bills" });

  return app;
}
