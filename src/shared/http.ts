import type { Sample } from "../resources.js";

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

const NOT_FOUND_BODY = {
  type: "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  title: "Not Found",
  status: 404,
};

export const CORS_EXPOSE_HEADERS = "X-Total-Count,X-Page,X-Limit,X-Offset";
export const CORS_ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
export const CORS_ALLOW_HEADERS = "Content-Type,Authorization";

export interface CollectionQueryResult {
  items: Sample[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export function notFoundJson(): {
  status: 404;
  body: typeof NOT_FOUND_BODY;
  headers: Record<string, string>;
} {
  return {
    status: 404,
    body: NOT_FOUND_BODY,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": CORS_EXPOSE_HEADERS,
    },
  };
}

function flattenValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(flattenValues);
  }
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

export function applyCollectionQuery(items: Sample[], url: string): CollectionQueryResult {
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

export function applyCollectionHeaders(
  ctxHeaders: Headers,
  result: CollectionQueryResult,
): void {
  ctxHeaders.set("X-Total-Count", String(result.total));
  ctxHeaders.set("X-Page", String(result.page));
  ctxHeaders.set("X-Limit", String(result.limit));
  ctxHeaders.set("X-Offset", String(result.offset));
}

export function collectionResponse(
  ctxHeaders: Headers,
  url: string,
  items: Sample[],
): Sample[] {
  const result = applyCollectionQuery(items, url);
  applyCollectionHeaders(ctxHeaders, result);
  return result.items;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
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