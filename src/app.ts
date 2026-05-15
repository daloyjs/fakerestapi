/**
 * DaloyJS port of the FakeRESTApi reference server.
 *
 * Same ~700 endpoints as `honojs-large-fakerestapi`, expressed with DaloyJS
 * idioms:
 *
 *  - `App` constructed with `bodyLimitBytes` + `requestTimeoutMs` (secure
 *    defaults baked in).
 *  - `app.use(...)` to compose `requestId`, `secureHeaders`, and `cors` once.
 *  - Each resource is mounted as a Fastify-style encapsulated plugin via
 *    `app.register(resourcePlugin(def), { prefix, tags })` so collections,
 *    items, and nested relationships ride a single tag and are easy to
 *    introspect via `app.routes`.
 *  - Cross-resource convenience routes are registered the same way, using
 *    `NotFoundError` (RFC 9457 problem+json) for misses.
 *  - Swagger UI / JSON / YAML and the `_meta` endpoint are mounted last via
 *    a small "docs" plugin that serves the `buildOpenApi()` document.
 *
 * Mutations are not persisted — this server is a deterministic mock.
 */

import {
  App,
  cors,
} from "@daloyjs/core";

import {
  RESOURCES,
  seededCountFor,
  type ResourceDef,
  type Sample,
} from "./resources.js";
import {
  ADDITIONAL_RELATIONSHIP_ROUTES,
  QUERYABLE_RELATIONSHIP_PATHS,
  QUERYABLE_RESOURCES,
} from "./relationship-routes.js";
import { enrichSample } from "./relationships.js";
import {
  API_TITLE,
  buildOpenApi,
  endpointCount,
} from "./openapi.js";
import { yamlDump } from "./yaml.js";

// ---------- Collection query helpers (parity with the Hono reference) ----------

const QUERY_CONTROL_KEYS = new Set([
  "page",
  "limit",
  "offset",
  "q",
  "search",
  "sort",
  "order",
  "fields",
]);

const HONO_NOT_FOUND_BODY = {
  type: "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  title: "Not Found",
  status: 404,
};
const HONO_CORS_EXPOSE_HEADERS = "X-Total-Count,X-Page,X-Limit,X-Offset";
const HONO_CORS_ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const HONO_CORS_ALLOW_HEADERS = "Content-Type,Authorization";

function honoNotFoundJson(): {
  status: 404;
  body: typeof HONO_NOT_FOUND_BODY;
  headers: Record<string, string>;
} {
  return {
    status: 404,
    body: HONO_NOT_FOUND_BODY,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": HONO_CORS_EXPOSE_HEADERS,
    },
  };
}

interface CollectionQueryResult {
  items: Sample[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

function listFor(def: ResourceDef): Sample[] {
  const n = seededCountFor(def);
  const out: Sample[] = [];
  for (let i = 1; i <= n; i++) out.push(enrichSample(def.name, def.sample(i)));
  return out;
}

function getById(def: ResourceDef, id: number): Sample | null {
  if (!Number.isInteger(id) || id < 1) return null;
  const max = seededCountFor(def);
  if (id > max) return null;
  return enrichSample(def.name, def.sample(id));
}

function resourceNamed(name: string): ResourceDef {
  const def = RESOURCES.find((resource) => resource.name === name);
  if (!def) throw new Error(`Unknown resource: ${name}`);
  return def;
}

function flattenValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>).flatMap(flattenValues);
  return [String(value).toLowerCase()];
}

function scalarValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value).toLowerCase();
  return String(value).toLowerCase();
}

function numberParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(params.get(name));
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function filterValues(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function fieldValues(params: URLSearchParams): string[] {
  return params
    .getAll("fields")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function projectFields(item: Sample, fields: string[]): Sample {
  const projected: Sample = {};
  for (const field of fields) projected[field] = item[field];
  return projected;
}

function applyCollectionQuery(items: Sample[], url: string): CollectionQueryResult {
  const params = new URL(url).searchParams;
  let out = [...items];

  for (const key of new Set(params.keys())) {
    if (QUERY_CONTROL_KEYS.has(key)) continue;
    const values = filterValues(params, key);
    if (values.length === 0) continue;
    out = out.filter((item) => values.includes(scalarValue(item[key])));
  }

  const search = (params.get("q") ?? params.get("search") ?? "").trim().toLowerCase();
  if (search) {
    out = out.filter((item) => flattenValues(item).some((value) => value.includes(search)));
  }

  const sortParam = params.get("sort");
  if (sortParam) {
    const descending =
      sortParam.startsWith("-") || params.get("order")?.toLowerCase() === "desc";
    const field = sortParam.replace(/^-/, "");
    out.sort((left, right) =>
      scalarValue(left[field]).localeCompare(scalarValue(right[field]), undefined, {
        numeric: true,
      }),
    );
    if (descending) out.reverse();
  }

  const total = out.length;
  const hasPagination = params.has("page") || params.has("limit") || params.has("offset");
  const limit = hasPagination ? numberParam(params, "limit", 10, 1, 100) : total;
  const page = numberParam(params, "page", 1, 1, Number.MAX_SAFE_INTEGER);
  const offset = params.has("offset")
    ? numberParam(params, "offset", 0, 0, Number.MAX_SAFE_INTEGER)
    : (page - 1) * limit;
  out = hasPagination ? out.slice(offset, offset + limit) : out;

  const fields = fieldValues(params);
  if (fields.length > 0) out = out.map((item) => projectFields(item, fields));

  return { items: out, total, page, limit, offset };
}

/** Helper that drops collection metadata into the Daloy context headers. */
function applyCollectionHeaders(
  ctxHeaders: Headers,
  result: CollectionQueryResult,
): void {
  ctxHeaders.set("X-Total-Count", String(result.total));
  ctxHeaders.set("X-Page", String(result.page));
  ctxHeaders.set("X-Limit", String(result.limit));
  ctxHeaders.set("X-Offset", String(result.offset));
}

function collectionResponse(
  ctxHeaders: Headers,
  url: string,
  items: Sample[],
): Sample[] {
  const result = applyCollectionQuery(items, url);
  applyCollectionHeaders(ctxHeaders, result);
  return result.items;
}

function relationshipCollectionResponse(
  ctxHeaders: Headers,
  url: string,
  oasPath: string,
  items: Sample[],
): Sample[] {
  return QUERYABLE_RELATIONSHIP_PATHS.has(oasPath)
    ? collectionResponse(ctxHeaders, url, items)
    : items;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// ---------- Plugin: per-resource CRUD ----------

/**
 * Builds an encapsulated plugin that mounts all 6 CRUD endpoints for a
 * single resource. Registered with `app.register(plugin, { prefix, tags })`
 * so each resource owns its tag and routes are easy to introspect.
 */
function resourcePlugin(def: ResourceDef): { name: string; register: (app: App) => void } {
  return {
    name: `resource:${def.name}`,
    register(api) {
      const queryable = QUERYABLE_RESOURCES.has(def.name);

      api.route({
        method: "GET",
        path: "/",
        operationId: `list${def.name}`,
        summary: `List all ${def.name}`,
        responses: { 200: { description: "Success" } },
        handler: async ({ request, set }) => {
          const items = listFor(def);
          const body = queryable
            ? collectionResponse(set.headers, request.url, items)
            : items;
          return { status: 200 as const, body };
        },
      });

      api.route({
        method: "POST",
        path: "/",
        operationId: `create${def.name}`,
        summary: `Create a new ${def.name}`,
        responses: { 200: { description: "Success" } },
        handler: async ({ request }) => {
          const body = await readJsonBody(request);
          return {
            status: 200 as const,
            body: enrichSample(def.name, {
              id: (body.id as number | undefined) ?? seededCountFor(def) + 1,
              ...body,
            }),
          };
        },
      });

      api.route({
        method: "GET",
        path: "/:id",
        operationId: `get${def.name}ById`,
        summary: `Get a ${def.name} by id`,
        responses: {
          200: { description: "Success" },
          404: { description: "Not Found" },
        },
        handler: async ({ params }) => {
          const item = getById(def, Number((params as { id: string }).id));
          if (!item) return honoNotFoundJson();
          return { status: 200 as const, body: item };
        },
      });

      api.route({
        method: "PUT",
        path: "/:id",
        operationId: `replace${def.name}`,
        summary: `Replace a ${def.name}`,
        responses: { 200: { description: "Success" } },
        handler: async ({ params, request }) => {
          const id = Number((params as { id: string }).id);
          const body = await readJsonBody(request);
          return {
            status: 200 as const,
            body: enrichSample(def.name, { ...body, id }),
          };
        },
      });

      api.route({
        method: "PATCH",
        path: "/:id",
        operationId: `patch${def.name}`,
        summary: `Partially update a ${def.name}`,
        responses: { 200: { description: "Success" } },
        handler: async ({ params, request }) => {
          const id = Number((params as { id: string }).id);
          const body = await readJsonBody(request);
          const baseObj = def.sample(id) ?? {};
          return {
            status: 200 as const,
            body: enrichSample(def.name, { ...baseObj, ...body, id }),
          };
        },
      });

      api.route({
        method: "DELETE",
        path: "/:id",
        operationId: `delete${def.name}`,
        summary: `Delete a ${def.name}`,
        responses: { 200: { description: "Success" } },
        handler: async () => ({
          status: 200 as const,
          body: null,
          headers: { "x-remove-content-type": "1" },
        }),
      });
    },
  };
}

// ---------- Plugin: cross-resource relationship endpoints ----------

interface NestedFromParent {
  /** Parent resource that must exist (returns 404 otherwise). */
  parent: string;
  /** Field on the parent record that contains the related collection. */
  field: string;
}

interface NestedByForeignKey {
  /** Resource to scan for matching items. */
  child: string;
  /** Foreign-key field on the child record that points back to the parent id. */
  foreignKey: string;
}

type NestedRoute = {
  path: `/${string}`;
  oasPath: string;
  parentResource: string;
  tag: string;
  operationId: string;
  summary: string;
} & ({ kind: "fromParent"; spec: NestedFromParent } | { kind: "byForeignKey"; spec: NestedByForeignKey });

const NESTED_ROUTES: NestedRoute[] = [
  // Routes that read an embedded array off the parent record.
  fromParent("/api/v1/Books/:id/authors", "Books", "authors", "Books", "getBookAuthors", "List related authors for a given book id"),
  fromParent("/api/v1/Books/:id/coverPhotos", "Books", "coverPhotos", "Books", "getBookCoverPhotos", "List related cover photos for a given book id"),
  fromParent("/api/v1/Customers/:id/orders", "Customers", "orders", "Customers", "getCustomerOrders", "List related orders for a given customer id"),
  fromParent("/api/v1/Orders/:id/items", "Orders", "items", "Orders", "getOrderItems", "List related order items for a given order id"),
  fromParent("/api/v1/Products/:id/reviews", "Products", "reviews", "Products", "getProductReviews", "List related reviews for a given product id"),
  fromParent("/api/v1/Projects/:id/tasks", "Projects", "tasks", "Projects", "getProjectTasks", "List related tasks for a given project id"),
  fromParent("/api/v1/Carts/:id/items", "Carts", "items", "Carts", "getCartItems", "List related cart items for a given cart id"),
  fromParent("/api/v1/Wishlists/:id/items", "Wishlists", "items", "Wishlists", "getWishlistItems", "List related wishlist items for a given wishlist id"),
  fromParent("/api/v1/Hotels/:id/bookings", "Hotels", "bookings", "Hotels", "getHotelBookings", "List related bookings for a given hotel id"),
  fromParent("/api/v1/Articles/:id/tags", "Articles", "tags", "Articles", "getArticleTags", "List related tags for a given article id"),
  fromParent("/api/v1/Departments/:id/employees", "Departments", "employees", "Departments", "getDepartmentEmployees", "List related employees for a given department id"),
  fromParent("/api/v1/Vendors/:id/transactions", "Vendors", "transactions", "Vendors", "getVendorTransactions", "List related transactions for a given vendor id"),
  fromParent("/api/v1/Reviews/:id/replies", "Reviews", "replies", "Reviews", "getReviewReplies", "List related replies for a given review id"),
  fromParent("/api/v1/Conversations/:id/messages", "Conversations", "messages", "Conversations", "getConversationMessages", "List related messages for a given conversation id"),

  // Routes that scan another resource by foreign key.
  byForeignKey("/api/v1/Products/:id/variants", "Products", "ProductVariants", "productId", "Products", "getProductVariants", "List related variants for a given product id"),
  byForeignKey("/api/v1/Products/:id/favorites", "Products", "Favorites", "productId", "Products", "getProductFavorites", "List related favorites for a given product id"),
  byForeignKey("/api/v1/Users/:id/badges", "Users", "UserBadges", "userId", "Users", "getUserBadges", "List related badges for a given user id"),
  byForeignKey("/api/v1/Orders/:id/refunds", "Orders", "Refunds", "orderId", "Orders", "getOrderRefunds", "List related refunds for a given order id"),
  byForeignKey("/api/v1/Customers/:id/reviews", "Customers", "Reviews", "customerId", "Customers", "getCustomerReviews", "List related reviews for a given customer id"),
];

function fromParent(
  path: `/${string}`,
  parent: string,
  field: string,
  tag: string,
  operationId: string,
  summary: string,
): NestedRoute {
  return {
    kind: "fromParent",
    path,
    oasPath: pathToOasPath(path),
    parentResource: parent,
    tag,
    operationId,
    summary,
    spec: { parent, field },
  };
}

function byForeignKey(
  path: `/${string}`,
  parent: string,
  child: string,
  foreignKey: string,
  tag: string,
  operationId: string,
  summary: string,
): NestedRoute {
  return {
    kind: "byForeignKey",
    path,
    oasPath: pathToOasPath(path),
    parentResource: parent,
    tag,
    operationId,
    summary,
    spec: { child, foreignKey },
  };
}

function pathToOasPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

const relationshipsPlugin = {
  name: "relationships",
  register(api: App) {
    // Two cross-resource lookups inherited from the original fakerestapi.
    api.route({
      method: "GET",
      path: "/api/v1/Authors/authors/books/:idBook",
      operationId: "getAuthorsForBook",
      tags: ["Authors"],
      summary: "List authors for a given book id",
      responses: { 200: { description: "Success" } },
      handler: async ({ params }) => {
        const idBook = Number((params as { idBook: string }).idBook);
        const def = resourceNamed("Authors");
        const all = listFor(def) as Array<Sample & { idBook: number }>;
        return { status: 200 as const, body: all.filter((a) => a.idBook === idBook) };
      },
    });

    api.route({
      method: "GET",
      path: "/api/v1/CoverPhotos/books/covers/:idBook",
      operationId: "getCoverPhotosForBook",
      tags: ["CoverPhotos"],
      summary: "List cover photos for a given book id",
      responses: { 200: { description: "Success" } },
      handler: async ({ params }) => {
        const idBook = Number((params as { idBook: string }).idBook);
        const def = resourceNamed("CoverPhotos");
        const all = listFor(def) as Array<Sample & { idBook: number }>;
        return { status: 200 as const, body: all.filter((p) => p.idBook === idBook) };
      },
    });

    for (const route of NESTED_ROUTES) {
      api.route({
        method: "GET",
        path: route.path,
        operationId: route.operationId,
        tags: [route.tag],
        summary: route.summary,
        responses: {
          200: { description: "Success" },
          404: { description: "Not Found" },
        },
        handler: async ({ params, request, set }) => {
          const id = Number((params as { id: string }).id);
          const parent = getById(resourceNamed(route.parentResource), id);
          if (!parent) return honoNotFoundJson();

          let items: Sample[];
          if (route.kind === "fromParent") {
            items = (parent[route.spec.field] as Sample[]) ?? [];
          } else {
            const target = resourceNamed(route.spec.child);
            const all = listFor(target) as Array<Sample & Record<string, unknown>>;
            items = all.filter((item) => item[route.spec.foreignKey] === id);
          }
          const body = relationshipCollectionResponse(
            set.headers,
            request.url,
            route.oasPath,
            items,
          );
          return { status: 200 as const, body };
        },
      });
    }

    // Auto-generated parent->child relationships sourced from the catalog.
    for (const r of ADDITIONAL_RELATIONSHIP_ROUTES) {
      const path = r.path.replace(/\{id\}/g, ":id") as `/${string}`;
      api.route({
        method: "GET",
        path,
        operationId: opIdFor(r.path, r.parentResource, r.targetResource),
        tags: [r.tag],
        summary: r.summary,
        responses: {
          200: { description: "Success" },
          404: { description: "Not Found" },
        },
        handler: async ({ params, request, set }) => {
          const id = Number((params as { id: string }).id);
          const parent = getById(resourceNamed(r.parentResource), id);
          if (!parent) return honoNotFoundJson();
          const target = resourceNamed(r.targetResource);
          const all = listFor(target) as Array<Sample & Record<string, unknown>>;
          const items = all.filter((item) => item[r.foreignKey] === id);
          const body = relationshipCollectionResponse(
            set.headers,
            request.url,
            r.path,
            items,
          );
          return { status: 200 as const, body };
        },
      });
    }
  },
};

function opIdFor(path: string, parent: string, target: string): string {
  // Stable, unique id derived from the relationship path: e.g. get_Customers_carts.
  const tail = path.split("/").pop() ?? target.toLowerCase();
  return `get_${parent}_${tail}`;
}

// ---------- Plugin: OpenAPI + Swagger UI + meta ----------

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${API_TITLE} - API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style> body { margin: 0; } </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/swagger/v1/swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
      });
    };
  </script>
</body>
</html>`;

function docsPlugin() {
  let cachedDoc: Record<string, unknown> | null = null;
  let cachedYaml: string | null = null;
  const getDoc = () => (cachedDoc ??= buildOpenApi());
  const getYaml = () => (cachedYaml ??= yamlDump(getDoc()));

  return {
    name: "docs",
    register(api: App) {
      api.route({
        method: "GET",
        path: "/swagger/v1/swagger.json",
        operationId: "getSwaggerJson",
        tags: ["Meta"],
        summary: "OpenAPI 3 specification",
        responses: { 200: { description: "Success" } },
        handler: async () => ({ status: 200 as const, body: getDoc() }),
      });

      api.route({
        method: "GET",
        path: "/swagger/v1/swagger.yaml",
        operationId: "getSwaggerYaml",
        tags: ["Meta"],
        summary: "OpenAPI 3 specification (YAML)",
        responses: { 200: { description: "Success" } },
        handler: async () => ({
          status: 200 as const,
          body: getYaml(),
          headers: {
            "content-type": "text/yaml; charset=utf-8",
            "content-disposition": 'inline; filename="swagger.yaml"',
            "x-content-type-options": "nosniff",
          },
        }),
      });

      api.route({
        method: "GET",
        path: "/index.html",
        operationId: "getSwaggerUi",
        tags: ["Meta"],
        summary: "Swagger UI shell",
        responses: { 200: { description: "Success" } },
        handler: async () => ({
          status: 200 as const,
          body: SWAGGER_UI_HTML,
          headers: {
            "content-type": "text/html; charset=UTF-8",
          },
        }),
      });

      api.route({
        method: "GET",
        path: "/",
        operationId: "redirectToSwaggerUi",
        tags: ["Meta"],
        summary: "Redirect to Swagger UI",
        responses: { 302: { description: "Redirect" } },
        handler: async () => ({
          status: 302 as const,
          body: null,
          headers: { location: "/index.html" },
        }),
      });

      api.route({
        method: "GET",
        path: "/api/v1/_meta",
        operationId: "getMeta",
        tags: ["Meta"],
        summary: "Service metadata",
        responses: { 200: { description: "Success" } },
        handler: async () => {
          const doc = getDoc() as Record<string, any>;
          return {
            status: 200 as const,
            body: {
              title: doc.info.title,
              version: doc.info.version,
              resources: RESOURCES.length,
              endpointCount: endpointCount(doc),
              swagger: {
                json: "/swagger/v1/swagger.json",
                yaml: "/swagger/v1/swagger.yaml",
                ui: "/index.html",
              },
            },
          };
        },
      });
    },
  };
}

// ---------- App factory ----------

export function buildApp(): App {
  // Bake-in security defaults the way DaloyJS expects.
  const app = new App({
    title: API_TITLE,
    version: "1.0",
    bodyLimitBytes: 1024 * 1024,
    requestTimeoutMs: 30_000,
    // Avoid accidental 500s from response-validation against permissive specs.
    validateResponses: true,
    // Test-friendly logger; flip via env when running real servers.
    logger: process.env.DALOY_LOG === "1" ? undefined : false,
    hooks: {
      onError(error) {
        if (error instanceof Error && error.name === "NotFoundError") {
          return new Response("404 Not Found", {
            status: 404,
            headers: {
              "content-type": "text/plain; charset=UTF-8",
              "access-control-allow-origin": "*",
              "access-control-expose-headers": HONO_CORS_EXPOSE_HEADERS,
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

  // CORS — case preserved so the HTTP integration tests can match the exact
  // header value (`X-Total-Count`, `Content-Type`, ...) browsers will see.
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Offset"],
      maxAgeSeconds: 86400,
    }),
  );

  app.use({
    beforeHandle(ctx) {
      ctx.set.headers.set("access-control-allow-origin", "*");
      ctx.set.headers.set("access-control-expose-headers", HONO_CORS_EXPOSE_HEADERS);
      return undefined;
    },
    onResponse(response) {
      response.headers.delete("x-request-id");
      response.headers.set("access-control-allow-origin", "*");
      response.headers.set("access-control-expose-headers", HONO_CORS_EXPOSE_HEADERS);
      if (response.status === 204 && response.headers.has("access-control-allow-methods")) {
        response.headers.set("access-control-allow-methods", HONO_CORS_ALLOW_METHODS);
        response.headers.set("access-control-allow-headers", HONO_CORS_ALLOW_HEADERS);
        response.headers.set("vary", "Access-Control-Request-Headers");
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

  // One encapsulated plugin per resource keeps tags + introspection clean.
  for (const def of RESOURCES) {
    app.register(resourcePlugin(def), {
      prefix: `/api/v1/${def.name}` as `/${string}`,
      tags: [def.name],
    });
  }

  // Cross-resource relationship endpoints (parity with fakerestapi).
  app.register(relationshipsPlugin);

  // Swagger UI / JSON / YAML / _meta endpoints.
  app.register(docsPlugin());

  return app;
}

