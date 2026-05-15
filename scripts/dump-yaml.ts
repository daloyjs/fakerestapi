import app from "../src/index.js";

const r = await app.request("/swagger/v1/swagger.yaml");
process.stdout.write(await r.text());
