import type { App } from "@daloyjs/core";

import { API_TITLE, buildOpenApi, endpointCount } from "../../openapi.js";
import { RESOURCES } from "../../resources.js";
import { yamlDump } from "../../yaml.js";

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