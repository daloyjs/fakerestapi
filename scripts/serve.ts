import { serve } from "@daloyjs/core/node";
import app from "../src/index.js";

const port = Number(process.env.PORT ?? 3000);
const handle = serve(app, { port });

console.log(`FakeRESTApi.Daloy listening on http://localhost:${handle.port}`);
console.log(`Swagger UI:   http://localhost:${handle.port}/index.html`);
console.log(`Swagger JSON: http://localhost:${handle.port}/swagger/v1/swagger.json`);
console.log(`Swagger YAML: http://localhost:${handle.port}/swagger/v1/swagger.yaml`);
