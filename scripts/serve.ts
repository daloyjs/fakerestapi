import { serve } from "@daloyjs/core/node";
import app from "../src/index.js";

const port = Number(process.env.PORT ?? 3000);
const handle = serve(app, { port });

console.log(`FakeRESTApi.Daloy listening on http://localhost:${handle.port}`);
console.log(`Scalar docs:  http://localhost:${handle.port}/docs`);
console.log(`OpenAPI JSON: http://localhost:${handle.port}/openapi.json`);
console.log(`OpenAPI YAML: http://localhost:${handle.port}/openapi.yaml`);
