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
import {
  CORS_ALLOW_HEADERS,
  CORS_ALLOW_METHODS,
  CORS_EXPOSE_HEADERS,
} from "./shared/http.js";

const allowAnyOrigin = (_origin: string): boolean => true;

function responseCorsOrigin(origin: string | null): string {
  return origin ?? "*";
}

export function buildApp(options: { env?: "development" | "production" | "test" } = {}): App {
  const app = new App({
    title: API_TITLE,
    version: "1.0",
    ...(options.env ? { env: options.env } : {}),
    trustProxy: true,
    bodyLimitBytes: 1024 * 1024,
    requestTimeoutMs: 30_000,
    validateResponses: true,
    logger: process.env.DALOY_LOG === "1" ? undefined : false,
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
      // The demo is intentionally public, but the latest core now blocks a
      // literal wildcard CORS policy in production. Echo any concrete Origin
      // instead so the app still works cross-origin without disabling secure
      // defaults globally.
      origin: allowAnyOrigin,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Offset"],
      maxAgeSeconds: 86400,
    }),
  );

  app.use({
    beforeHandle(ctx) {
      const origin = ctx.request.headers.get("origin");
      ctx.set.headers.set("access-control-allow-origin", responseCorsOrigin(origin));
      ctx.set.headers.set("access-control-expose-headers", CORS_EXPOSE_HEADERS);
      if (origin) ctx.set.headers.set("vary", "Origin");
      return undefined;
    },
    onResponse(response) {
      response.headers.delete("x-request-id");
      if (!response.headers.has("access-control-allow-origin")) {
        response.headers.set("access-control-allow-origin", "*");
      }
      if (!response.headers.has("access-control-expose-headers")) {
        response.headers.set("access-control-expose-headers", CORS_EXPOSE_HEADERS);
      }
      if (response.status === 204 && response.headers.has("access-control-allow-methods")) {
        response.headers.set("access-control-allow-methods", CORS_ALLOW_METHODS);
        response.headers.set("access-control-allow-headers", CORS_ALLOW_HEADERS);
        const vary = response.headers.get("vary");
        response.headers.set(
          "vary",
          vary && vary.length > 0
            ? `${vary}, Access-Control-Request-Headers`
            : "Access-Control-Request-Headers",
        );
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