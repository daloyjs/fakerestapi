import type { App } from "@daloyjs/core";

import {
  RESOURCES,
  seededCountFor,
  type ResourceDef,
} from "../../resources.js";
import { QUERYABLE_RESOURCES } from "../../relationship-routes.js";
import { enrichSample } from "../../relationships.js";
import { collectionResponse, notFoundJson, readJsonBody } from "../../shared/http.js";
import { getById, listFor } from "../../shared/resources.js";

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
          if (!item) return notFoundJson();
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

export const resourcesModule = {
  name: "resources",
  register(app: App) {
    for (const def of RESOURCES) {
      app.register(resourcePlugin(def), {
        prefix: `/api/v1/${def.name}`,
        tags: [def.name],
      });
    }
  },
};