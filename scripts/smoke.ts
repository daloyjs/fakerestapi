import app from "../src/index.js";

async function req(path: string, init?: RequestInit): Promise<Response> {
  return app.request(path, init);
}

const meta = await (await req("/api/v1/_meta")).json();
console.log("META:", meta);

const yaml = await (await req("/openapi.yaml")).text();
console.log("YAML bytes:", yaml.length);
console.log("YAML head:\n" + yaml.slice(0, 500));

const a = await (await req("/api/v1/Activities")).json();
console.log("Activities count:", a.length, "first:", a[0]);

const p5 = await (await req("/api/v1/Products/5")).json();
console.log("Product 5:", p5);

const order1 = await (await req("/api/v1/Orders/1")).json();
console.log("Order 1 relationships:", {
  customer: order1.customer,
  firstItem: order1.items?.[0],
  invoice: order1.invoice,
  shipment: order1.shipment,
});

const customer1Orders = await (await req("/api/v1/Customers/1/orders")).json();
console.log("Customer 1 orders:", customer1Orders);

const post = await req("/api/v1/Books", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "New Book" }),
});
console.log("POST status:", post.status, "body:", await post.json());

const nf = await req("/api/v1/Cars/9999");
console.log("NotFound status:", nf.status);

const json = await (await req("/openapi.json")).json();
console.log("Total path entries:", Object.keys(json.paths).length);
