// Builds an OpenAPI 3.0.3 document from the resource catalog.
// Schemas are inferred from the deterministic `sample(1)` of each resource.

import { RESOURCES, type ResourceDef, type Sample } from './resources.js';
import { ADDITIONAL_RELATIONSHIP_ROUTES, QUERYABLE_RELATIONSHIP_PATHS, QUERYABLE_RESOURCES } from './relationship-routes.js';
import { enrichSample } from './relationships.js';

type Schema = Record<string, any>;

export const API_TITLE = 'FakeRESTApi.Hono.V1';
export const API_DESCRIPTION =
  'A seeded mock API for testing integrations, frontends, and SDKs. It offers a wide catalog of resources, deterministic responses, and relationship-rich sample data. Write operations return realistic payloads without persisting changes.';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function singularizeResourceName(name: string): string {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`;
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

const COLLECTION_QUERY_PARAMETERS = [
  {
    name: 'page',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: '1-based page number. Used with limit when paginating collection results.',
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
    description: 'Maximum number of items to return. Pagination metadata is exposed through X-Total-Count, X-Page, X-Limit, and X-Offset headers.',
  },
  {
    name: 'offset',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 0 },
    description: 'Zero-based item offset. Takes precedence over page when present.',
  },
  {
    name: 'q',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Case-insensitive search across scalar values in each item.',
  },
  {
    name: 'search',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Alias for q.',
  },
  {
    name: 'sort',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Sort by a top-level field. Prefix with - or set order=desc for descending order.',
  },
  {
    name: 'order',
    in: 'query',
    required: false,
    schema: { type: 'string', enum: ['asc', 'desc'] },
    description: 'Sort direction used with sort.',
  },
  {
    name: 'fields',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Comma-separated top-level fields to include in each returned item.',
  },
  {
    name: '<field>',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Any other query parameter is treated as an equality filter. Repeated values and comma-separated values are supported.',
  },
] as const;

function inferType(v: unknown): Schema {
  if (v === null || v === undefined) return { type: 'string', nullable: true };
  if (Array.isArray(v)) {
    const item = v.length > 0 ? inferType(v[0]) : { type: 'string' };
    return { type: 'array', items: item };
  }
  switch (typeof v) {
    case 'boolean':
      return { type: 'boolean' };
    case 'number':
      return Number.isInteger(v) ? { type: 'integer', format: 'int32' } : { type: 'number', format: 'double' };
    case 'string':
      return ISO_DATE.test(v) ? { type: 'string', format: 'date-time' } : { type: 'string' };
    case 'object': {
      const props: Record<string, Schema> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        props[k] = inferType(val);
      }
      return { type: 'object', properties: props };
    }
    default:
      return { type: 'string' };
  }
}

function schemaForResource(def: ResourceDef): Schema {
  const sample = enrichSample(def.name, def.sample(1));
  const properties: Record<string, Schema> = {};
  for (const [k, v] of Object.entries(sample)) {
    properties[k] = inferType(v);
  }
  return { type: 'object', additionalProperties: false, properties };
}

function pathItemFor(def: ResourceDef): { collection: any; item: any } {
  const tag = def.name;
  const singular = singularizeResourceName(def.name);
  const ref = `#/components/schemas/${singular}`;
  const arrRef = { type: 'array', items: { $ref: ref } };
  const reqBody = {
    required: true,
    content: { 'application/json': { schema: { $ref: ref } } },
  };
  const okJson = (schema: any) => ({
    description: 'Success',
    content: {
      'application/json': { schema },
      'application/xml': { schema },
      'text/plain': { schema },
    },
  });
  const idParam = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'integer', format: 'int32' },
  };

  const collection = {
    get: {
      tags: [tag],
      summary: `List all ${tag}`,
      parameters: QUERYABLE_RESOURCES.has(def.name) ? COLLECTION_QUERY_PARAMETERS : [],
      responses: { '200': okJson(arrRef) },
    },
    post: {
      tags: [tag],
      summary: `Create a new ${singular}`,
      requestBody: reqBody,
      responses: { '200': okJson({ $ref: ref }) },
    },
  };

  const item = {
    get: {
      tags: [tag],
      summary: `Get a ${singular} by id`,
      parameters: [idParam],
      responses: {
        '200': okJson({ $ref: ref }),
        '404': { description: 'Not Found' },
      },
    },
    put: {
      tags: [tag],
      summary: `Replace a ${singular}`,
      parameters: [idParam],
      requestBody: reqBody,
      responses: { '200': okJson({ $ref: ref }) },
    },
    patch: {
      tags: [tag],
      summary: `Partially update a ${singular}`,
      parameters: [idParam],
      requestBody: reqBody,
      responses: { '200': okJson({ $ref: ref }) },
    },
    delete: {
      tags: [tag],
      summary: `Delete a ${singular}`,
      parameters: [idParam],
      responses: { '200': { description: 'Success' } },
    },
  };

  return { collection, item };
}

export function buildOpenApi(): Record<string, any> {
  const paths: Record<string, any> = {};
  const schemas: Record<string, any> = {};
  const tags: Array<{ name: string; description: string }> = [];
  const okJson = (schema: any) => ({
    description: 'Success',
    content: {
      'application/json': { schema },
    },
  });

  for (const def of RESOURCES) {
    tags.push({ name: def.name, description: def.description });
    const singular = singularizeResourceName(def.name);
    schemas[singular] = schemaForResource(def);
    const { collection, item } = pathItemFor(def);
    paths[`/api/v1/${def.name}`] = collection;
    paths[`/api/v1/${def.name}/{id}`] = item;
  }

  // Cross-resource routes that round out relationship traversal.
  const okArr = (ref: string) => okJson({ type: 'array', items: { $ref: `#/components/schemas/${ref}` } });
  const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer', format: 'int32' } };
  const okObjectArr = okJson({ type: 'array', items: { type: 'object' } });
  const addRelatedPath = (path: string, tag: string, summary: string, response: any = okObjectArr) => {
    const parameters = QUERYABLE_RELATIONSHIP_PATHS.has(path) ? [idParam, ...COLLECTION_QUERY_PARAMETERS] : [idParam];
    paths[path] = {
      get: {
        tags: [tag],
        summary,
        parameters,
        responses: { '200': response, '404': { description: 'Not Found' } },
      },
    };
  };

  paths['/api/v1/Authors/authors/books/{idBook}'] = {
    get: {
      tags: ['Authors'],
      summary: 'List authors for a given book id',
      parameters: [{ name: 'idBook', in: 'path', required: true, schema: { type: 'integer', format: 'int32' } }],
      responses: { '200': okArr('Author') },
    },
  };
  paths['/api/v1/CoverPhotos/books/covers/{idBook}'] = {
    get: {
      tags: ['CoverPhotos'],
      summary: 'List cover photos for a given book id',
      parameters: [{ name: 'idBook', in: 'path', required: true, schema: { type: 'integer', format: 'int32' } }],
      responses: { '200': okArr('CoverPhoto') },
    },
  };
  addRelatedPath('/api/v1/Books/{id}/authors', 'Books', 'List related authors for a given book id', okArr('Author'));
  addRelatedPath('/api/v1/Books/{id}/coverPhotos', 'Books', 'List related cover photos for a given book id', okArr('CoverPhoto'));
  addRelatedPath('/api/v1/Customers/{id}/orders', 'Customers', 'List related orders for a given customer id');
  addRelatedPath('/api/v1/Customers/{id}/reviews', 'Customers', 'List related reviews for a given customer id', okArr('Review'));
  addRelatedPath('/api/v1/Orders/{id}/items', 'Orders', 'List related order items for a given order id');
  addRelatedPath('/api/v1/Orders/{id}/refunds', 'Orders', 'List related refunds for a given order id', okArr('Refund'));
  addRelatedPath('/api/v1/Products/{id}/reviews', 'Products', 'List related reviews for a given product id');
  addRelatedPath('/api/v1/Products/{id}/variants', 'Products', 'List related variants for a given product id', okArr('ProductVariant'));
  addRelatedPath('/api/v1/Products/{id}/favorites', 'Products', 'List related favorites for a given product id', okArr('Favorite'));
  addRelatedPath('/api/v1/Projects/{id}/tasks', 'Projects', 'List related tasks for a given project id');
  addRelatedPath('/api/v1/Carts/{id}/items', 'Carts', 'List related cart items for a given cart id', okArr('CartItem'));
  addRelatedPath('/api/v1/Wishlists/{id}/items', 'Wishlists', 'List related wishlist items for a given wishlist id', okArr('WishlistItem'));
  addRelatedPath('/api/v1/Users/{id}/badges', 'Users', 'List related badges for a given user id', okArr('UserBadge'));
  addRelatedPath('/api/v1/Hotels/{id}/bookings', 'Hotels', 'List related bookings for a given hotel id', okArr('Booking'));
  addRelatedPath('/api/v1/Articles/{id}/tags', 'Articles', 'List related tags for a given article id', okArr('ArticleTag'));
  addRelatedPath('/api/v1/Departments/{id}/employees', 'Departments', 'List related employees for a given department id', okArr('Employee'));
  addRelatedPath('/api/v1/Vendors/{id}/transactions', 'Vendors', 'List related transactions for a given vendor id', okArr('Transaction'));
  addRelatedPath('/api/v1/Reviews/{id}/replies', 'Reviews', 'List related replies for a given review id', okArr('ReviewReply'));
  addRelatedPath('/api/v1/Conversations/{id}/messages', 'Conversations', 'List related messages for a given conversation id', okArr('Message'));

  for (const route of ADDITIONAL_RELATIONSHIP_ROUTES) {
    addRelatedPath(route.path, route.tag, route.summary, okObjectArr);
  }

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      description: API_DESCRIPTION,
      version: '1.0',
      contact: { name: API_TITLE, url: 'https://github.com/' },
    },
    tags,
    paths,
    components: { schemas },
  };
}

export function endpointCount(doc: Record<string, any>): number {
  let total = 0;
  for (const item of Object.values(doc.paths as Record<string, any>)) {
    for (const k of Object.keys(item)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(k)) total++;
    }
  }
  return total;
}

