import type { App } from "@daloyjs/core";

import {
  ADDITIONAL_RELATIONSHIP_ROUTES,
  NESTED_RELATIONSHIP_ROUTES,
  operationIdForRelationshipPath,
  QUERYABLE_RELATIONSHIP_PATHS,
} from "../../relationship-routes.js";
import type { Sample } from "../../resources.js";
import { collectionResponse, notFoundJson } from "../../shared/http.js";
import { getById, listFor, resourceNamed } from "../../shared/resources.js";

function pathToOasPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
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

function opIdFor(path: string, parent: string, target: string): string {
  return operationIdForRelationshipPath(path, parent, target);
}

export const relationshipsModule = {
  name: "relationships",
  register(api: App) {
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
        return { status: 200 as const, body: all.filter((author) => author.idBook === idBook) };
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
        return { status: 200 as const, body: all.filter((photo) => photo.idBook === idBook) };
      },
    });

    for (const route of NESTED_RELATIONSHIP_ROUTES) {
      const oasPath = pathToOasPath(route.path);
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
          if (!parent) return notFoundJson();

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
            oasPath,
            items,
          );
          return { status: 200 as const, body };
        },
      });
    }

    for (const route of ADDITIONAL_RELATIONSHIP_ROUTES) {
      const path = route.path.replace(/\{id\}/g, ":id") as `/${string}`;
      api.route({
        method: "GET",
        path,
        operationId: opIdFor(route.path, route.parentResource, route.targetResource),
        tags: [route.tag],
        summary: route.summary,
        responses: {
          200: { description: "Success" },
          404: { description: "Not Found" },
        },
        handler: async ({ params, request, set }) => {
          const id = Number((params as { id: string }).id);
          const parent = getById(resourceNamed(route.parentResource), id);
          if (!parent) return notFoundJson();

          const target = resourceNamed(route.targetResource);
          const all = listFor(target) as Array<Sample & Record<string, unknown>>;
          const items = all.filter((item) => item[route.foreignKey] === id);
          const body = relationshipCollectionResponse(set.headers, request.url, route.path, items);
          return { status: 200 as const, body };
        },
      });
    }
  },
};
