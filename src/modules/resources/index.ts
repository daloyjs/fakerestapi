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

      api.get(
        "/",
        {
          operationId: `list${def.name}`,
          summary: `List all ${def.name}`,
          responses: { 200: { description: "Success" } },
        },
        async ({ request, set }) => {
          const items = listFor(def);
          const body = queryable
            ? collectionResponse(set.headers, request.url, items)
            : items;
          return { status: 200 as const, body };
        },
      );

      api.post(
        "/",
        {
          operationId: `create${def.name}`,
          summary: `Create a new ${def.name}`,
          responses: { 200: { description: "Success" } },
        },
        async ({ request }) => {
          const body = await readJsonBody(request);
          return {
            status: 200 as const,
            body: enrichSample(def.name, {
              id: (body.id as number | undefined) ?? seededCountFor(def) + 1,
              ...body,
            }),
          };
        },
      );

      api.get(
        "/:id",
        {
          operationId: `get${def.name}ById`,
          summary: `Get a ${def.name} by id`,
          responses: {
            200: { description: "Success" },
            404: { description: "Not Found" },
          },
        },
        async ({ params }) => {
          const item = getById(def, Number((params as { id: string }).id));
          if (!item) return notFoundJson();
          return { status: 200 as const, body: item };
        },
      );

      api.put(
        "/:id",
        {
          operationId: `replace${def.name}`,
          summary: `Replace a ${def.name}`,
          responses: { 200: { description: "Success" } },
        },
        async ({ params, request }) => {
          const id = Number((params as { id: string }).id);
          const body = await readJsonBody(request);
          return {
            status: 200 as const,
            body: enrichSample(def.name, { ...body, id }),
          };
        },
      );

      api.patch(
        "/:id",
        {
          operationId: `patch${def.name}`,
          summary: `Partially update a ${def.name}`,
          responses: { 200: { description: "Success" } },
        },
        async ({ params, request }) => {
          const id = Number((params as { id: string }).id);
          const body = await readJsonBody(request);
          const baseObj = def.sample(id) ?? {};
          return {
            status: 200 as const,
            body: enrichSample(def.name, { ...baseObj, ...body, id }),
          };
        },
      );

      api.delete(
        "/:id",
        {
          operationId: `delete${def.name}`,
          summary: `Delete a ${def.name}`,
          responses: { 200: { description: "Success" } },
        },
        async () => ({
          status: 200 as const,
          body: null,
          headers: { "x-remove-content-type": "1" },
        }),
      );
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