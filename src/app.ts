/**
 * DaloyJS port of the FakeRESTApi reference server.
 *
 * The demo now follows a modular-monolith layout: shared HTTP behavior lives in
 * a small kernel, route families register as modules, and this file stays as the
 * composition root.
 */

import { App, cors } from "@daloyjs/core";

import { API_TITLE } from "./openapi.js";
import { registerModules } from "./platform/modules.js";
import { CORS_EXPOSE_HEADERS } from "./shared/http.js";

// Public demo API: echo any concrete Origin. A literal `origin: "*"` is
// refused at boot in production (https://daloyjs.dev/docs/security/boot-guards).
const allowAnyOrigin = (_origin: string): boolean => true;

export function buildApp(options: { env?: "development" | "production" | "test" } = {}): App {
  const app = new App({
    title: API_TITLE,
    version: "1.0",
    ...(options.env ? { env: options.env } : {}),
    behindProxy: { hops: 1 },
    bodyLimitBytes: 1024 * 1024,
    requestTimeoutMs: 30_000,
    validateResponses: true,
    logger: process.env.DALOY_LOG === "1" ? undefined : false,
    // Default CORP is `same-origin`, which blocks browser clients on other
    // origins even after CORS succeeds. This API is meant to be called from
    // workshops and demos, so opt the auto-installed headers into
    // `cross-origin` (https://daloyjs.dev/docs/security).
    secureHeaders: { crossOriginResourcePolicy: "cross-origin" },
    hooks: {
      onError(error) {
        if (error instanceof Error && error.name === "NotFoundError") {
          return new Response("404 Not Found", {
            status: 404,
            headers: {
              "content-type": "text/plain; charset=UTF-8",
              "access-control-allow-origin": "*",
              "access-control-expose-headers": CORS_EXPOSE_HEADERS,
            },
          });
        }
        return undefined;
      },
      onResponse(response) {
        response.headers.delete("x-request-id");
      },
    },
  });

  app.use(
    cors({
      origin: allowAnyOrigin,
      credentials: false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
      exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Offset"],
      maxAgeSeconds: 86400,
    }),
  );

  app.use({
    onResponse(response) {
      response.headers.delete("x-request-id");
      if (!response.headers.has("access-control-allow-origin")) {
        response.headers.set("access-control-allow-origin", "*");
      }
      if (!response.headers.has("access-control-expose-headers")) {
        response.headers.set("access-control-expose-headers", CORS_EXPOSE_HEADERS);
      }
    },
  });

  app.use({
    onResponse(response) {
      if (response.headers.get("x-remove-content-type") === "1") {
        response.headers.delete("x-remove-content-type");
        response.headers.delete("content-type");
      }
    },
  });

  registerModules(app);

  return app;
}
