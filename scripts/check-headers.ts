import app from "../src/index.js";

const response = await app.request("/swagger/v1/swagger.yaml");
console.log("status=", response.status);
console.log("content-type=", response.headers.get("content-type"));
console.log("content-disposition=", response.headers.get("content-disposition"));
console.log("x-content-type-options=", response.headers.get("x-content-type-options"));
