import type { App } from "@daloyjs/core";
import { docsContentSecurityPolicy, scalarHtml } from "@daloyjs/core/docs";

import { API_TITLE, buildOpenApi, endpointCount } from "../../openapi.js";
import { RESOURCES } from "../../resources.js";
import { yamlDump } from "../../yaml.js";

const OPENAPI_JSON_PATH = "/openapi.json";
const OPENAPI_YAML_PATH = "/openapi.yaml";
const DOCS_PATH = "/docs";

function redirect(location: string) {
  return {
    status: 302 as const,
    body: null,
    headers: { location },
  };
}

export function docsModule() {
  let cachedDoc: Record<string, unknown> | null = null;
  let cachedYaml: string | null = null;
  const getDoc = () => (cachedDoc ??= buildOpenApi());
  const getYaml = () => (cachedYaml ??= yamlDump(getDoc()));

  return {
    name: "docs",
    register(api: App) {
      api.route({
        method: "GET",
        path: OPENAPI_JSON_PATH,
        operationId: "getOpenApiJson",
        tags: ["Meta"],
        summary: "OpenAPI 3 specification",
        responses: { 200: { description: "Success" } },
        handler: async () => ({ status: 200 as const, body: getDoc() }),
      });

      api.route({
        method: "GET",
        path: OPENAPI_YAML_PATH,
        operationId: "getOpenApiYaml",
        tags: ["Meta"],
        summary: "OpenAPI 3 specification (YAML)",
        responses: { 200: { description: "Success" } },
        handler: async () => ({
          status: 200 as const,
          body: getYaml(),
          headers: {
            "content-type": "text/yaml; charset=utf-8",
            "content-disposition": 'inline; filename="openapi.yaml"',
            "x-content-type-options": "nosniff",
          },
        }),
      });

      api.route({
        method: "GET",
        path: DOCS_PATH,
        operationId: "getScalarDocs",
        tags: ["Meta"],
        summary: "Scalar API reference",
        responses: { 200: { description: "Success" } },
        handler: async () => ({
          status: 200 as const,
          body: scalarHtml({
            specUrl: OPENAPI_JSON_PATH,
            title: `${API_TITLE} - API Reference`,
          }),
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": docsContentSecurityPolicy(),
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
          },
        }),
      });

      api.route({
        method: "GET",
        path: "/",
        operationId: "redirectToDocs",
        tags: ["Meta"],
        summary: "Redirect to Scalar API reference",
        responses: { 302: { description: "Redirect" } },
        handler: async () => redirect(DOCS_PATH),
      });

      api.route({
        method: "GET",
        path: "/index.html",
        operationId: "redirectLegacyIndexHtml",
        tags: ["Meta"],
        summary: "Redirect legacy docs path to Scalar API reference",
        responses: { 302: { description: "Redirect" } },
        handler: async () => redirect(DOCS_PATH),
      });

      api.route({
        method: "GET",
        path: "/swagger/v1/swagger.json",
        operationId: "redirectLegacySwaggerJson",
        tags: ["Meta"],
        summary: "Redirect legacy Swagger JSON path to OpenAPI JSON",
        responses: { 302: { description: "Redirect" } },
        handler: async () => redirect(OPENAPI_JSON_PATH),
      });

      api.route({
        method: "GET",
        path: "/swagger/v1/swagger.yaml",
        operationId: "redirectLegacySwaggerYaml",
        tags: ["Meta"],
        summary: "Redirect legacy Swagger YAML path to OpenAPI YAML",
        responses: { 302: { description: "Redirect" } },
        handler: async () => redirect(OPENAPI_YAML_PATH),
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
              docs: {
                json: OPENAPI_JSON_PATH,
                yaml: OPENAPI_YAML_PATH,
                ui: DOCS_PATH,
                format: "scalar",
              },
            },
          };
        },
      });
    },
  };
}