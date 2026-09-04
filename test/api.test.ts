import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import { buildApp } from '../src/app.js';
import { API_TITLE, buildOpenApi, endpointCount } from '../src/openapi.js';
import { RESOURCES, seededCountFor } from '../src/resources.js';
import app from '../src/index.js';

async function request(path: string, init?: RequestInit): Promise<Response> {
  return await Promise.resolve(app.request(path, init));
}

async function requestJson(path: string, init?: RequestInit): Promise<any> {
  const response = await request(path, init);
  return await response.json();
}

test('meta endpoint reports resource and endpoint totals from the generated OpenAPI doc', async () => {
  const doc = buildOpenApi();
  const meta = await requestJson('/api/v1/_meta');

  assert.equal(meta.title, API_TITLE);
  assert.equal(meta.version, '1.0');
  assert.equal(meta.resources, RESOURCES.length);
  assert.equal(meta.endpointCount, endpointCount(doc));
  assert.deepEqual(meta.docs, {
    json: '/openapi.json',
    yaml: '/openapi.yaml',
    ui: '/docs',
    format: 'scalar',
  });
});

test('root redirects to Scalar docs and /docs serves the API reference shell', async () => {
  const redirect = await request('/');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/docs');

  const ui = await request('/docs');
  const html = await ui.text();
  assert.equal(ui.status, 200);
  assert.match(html, /api-reference/);
  assert.match(html, /openapi\.json/);
  assert.match(html, /withDefaultFonts&quot;:false/);
});

test('legacy Swagger paths redirect to the canonical Scalar and OpenAPI routes', async () => {
  const indexRedirect = await request('/index.html');
  assert.equal(indexRedirect.status, 302);
  assert.equal(indexRedirect.headers.get('location'), '/docs');

  const jsonRedirect = await request('/swagger/v1/swagger.json');
  assert.equal(jsonRedirect.status, 302);
  assert.equal(jsonRedirect.headers.get('location'), '/openapi.json');

  const yamlRedirect = await request('/swagger/v1/swagger.yaml');
  assert.equal(yamlRedirect.status, 302);
  assert.equal(yamlRedirect.headers.get('location'), '/openapi.yaml');
});

test('api responses include browser CORS headers', async () => {
  const response = await request('/api/v1/Promotions', {
    headers: { Origin: 'http://localhost:5173' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(response.headers.get('access-control-expose-headers') ?? '', /X-Total-Count/);
});

test('api supports CORS preflight requests', async () => {
  const response = await request('/api/v1/Promotions', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /GET/);
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /Content-Type/);
});

test('buildApp still boots in production with the public CORS policy', () => {
  assert.doesNotThrow(() => buildApp({ env: 'production' }));
});

test('production app accepts Vercel forwarded headers with an explicit proxy posture', async () => {
  const productionApp = buildApp({ env: 'production' });
  const response = await Promise.resolve(productionApp.request('/api/v1/_meta', {
    headers: {
      'X-Forwarded-For': '203.0.113.10',
      'X-Forwarded-Host': 'fakerestapi.vercel.app',
      'X-Forwarded-Proto': 'https',
    },
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.title, API_TITLE);
});

test('all resources expose collection and item GET endpoints', async (t) => {
  for (const resource of RESOURCES) {
    await t.test(resource.name, async () => {
      const collectionResponse = await request(`/api/v1/${resource.name}`);
      const collection = await collectionResponse.json();

      assert.equal(collectionResponse.status, 200);
      assert.ok(Array.isArray(collection));
      assert.equal(collection.length, seededCountFor(resource));
      assert.equal(collection[0].id, 1);

      const itemResponse = await request(`/api/v1/${resource.name}/1`);
      const item = await itemResponse.json();
      assert.equal(itemResponse.status, 200);
      assert.equal(item.id, 1);

      const notFoundResponse = await request(`/api/v1/${resource.name}/9999`);
      const notFound = await notFoundResponse.json();
      assert.equal(notFoundResponse.status, 404);
      assert.equal(notFound.status, 404);
      assert.equal(notFound.title, 'Not Found');
    });
  }
});

test('all resources expose generic mutation endpoints', async (t) => {
  for (const resource of RESOURCES) {
    await t.test(resource.name, async () => {
      const created = await request(`/api/v1/${resource.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customField: `created-${resource.name}` }),
      });
      const createdBody = await created.json();
      assert.equal(created.status, 200);
      assert.equal(createdBody.customField, `created-${resource.name}`);
      assert.ok(typeof createdBody.id === 'number');

      const replaced = await request(`/api/v1/${resource.name}/4`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaced: true }),
      });
      const replacedBody = await replaced.json();
      assert.equal(replaced.status, 200);
      assert.equal(replacedBody.id, 4);
      assert.equal(replacedBody.replaced, true);

      const patched = await request(`/api/v1/${resource.name}/5`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patched: true }),
      });
      const patchedBody = await patched.json();
      assert.equal(patched.status, 200);
      assert.equal(patchedBody.id, 5);
      assert.equal(patchedBody.patched, true);

      const deleted = await request(`/api/v1/${resource.name}/6`, { method: 'DELETE' });
      assert.equal(deleted.status, 200);
      assert.equal(await deleted.text(), '');
    });
  }
});

test('collection endpoints support pagination, filters, search, sorting, and field projection', async () => {
  const pageResponse = await request('/api/v1/Products?page=2&limit=3');
  const page = await pageResponse.json();
  assert.deepEqual(page.map((product: any) => product.id), [4, 5, 6]);
  assert.equal(pageResponse.headers.get('x-total-count'), '30');
  assert.equal(pageResponse.headers.get('x-page'), '2');
  assert.equal(pageResponse.headers.get('x-limit'), '3');
  assert.equal(pageResponse.headers.get('x-offset'), '3');

  const repeatedFilter = await requestJson('/api/v1/Products?color=red&color=blue&sort=id');
  assert.deepEqual(repeatedFilter.map((product: any) => product.id), [1, 2, 9, 10, 17, 18, 25, 26]);

  const commaFilter = await requestJson('/api/v1/Products?color=red,blue&sort=id');
  assert.deepEqual(commaFilter.map((product: any) => product.id), [1, 2, 9, 10, 17, 18, 25, 26]);

  const search = await requestJson('/api/v1/Products?q=Product%205');
  assert.equal(search.length, 1);
  assert.equal(search[0].id, 5);

  const sorted = await requestJson('/api/v1/Products?sort=-price&limit=3&fields=id,price');
  assert.deepEqual(sorted.map((product: any) => product.id), [30, 29, 28]);
  assert.deepEqual(Object.keys(sorted[0]).sort(), ['id', 'price']);

  const offset = await requestJson('/api/v1/Products?offset=2&limit=2&fields=id,name');
  assert.deepEqual(offset, [
    { id: 3, name: 'Product 3' },
    { id: 4, name: 'Product 4' },
  ]);
});

test('relationship collections also support query strings', async () => {
  const methodsResponse = await request('/api/v1/Customers/1/paymentMethods?limit=1&fields=id,type,customerId');
  const methods = await methodsResponse.json();
  assert.equal(methodsResponse.headers.get('x-total-count'), '2');
  assert.deepEqual(Object.keys(methods[0]).sort(), ['customerId', 'id', 'type']);
  assert.equal(methods[0].customerId, 1);

  const invoiceItems = await requestJson('/api/v1/Invoices/1/items?fields=id,productId,total&sort=-total');
  assert.ok(invoiceItems.length > 0);
  assert.deepEqual(Object.keys(invoiceItems[0]).sort(), ['id', 'productId', 'total']);

  const noMatches = await requestJson('/api/v1/Customers/1/paymentMethods?brand=NotARealBrand');
  assert.deepEqual(noMatches, []);
});

test('simple collection endpoints do not apply broad query controls', async () => {
  const booksResponse = await request('/api/v1/Books?limit=1&fields=id');
  const books = await booksResponse.json();
  assert.equal(books.length, 30);
  assert.equal(booksResponse.headers.get('x-total-count'), null);
  assert.ok(books[0].title);

  const employeesResponse = await request('/api/v1/Departments/1/employees?limit=1');
  const employees = await employeesResponse.json();
  assert.equal(employees.length, 3);
  assert.equal(employeesResponse.headers.get('x-total-count'), null);
});

test('mutations are fake and do not persist into subsequent GET responses', async () => {
  const before = await requestJson('/api/v1/Books/1');
  assert.equal(before.title, 'Book 1');

  const postResponse = await request('/api/v1/Books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, title: 'Mutated Book Title' }),
  });
  const postBody = await postResponse.json();
  assert.equal(postResponse.status, 200);
  assert.equal(postBody.title, 'Mutated Book Title');

  const after = await requestJson('/api/v1/Books/1');
  assert.equal(after.title, 'Book 1');
});

test('relationship-rich endpoints return nested real-world objects', async () => {
  const book = await requestJson('/api/v1/Books/1');
  assert.ok(Array.isArray(book.authors));
  assert.ok(Array.isArray(book.coverPhotos));

  const product = await requestJson('/api/v1/Products/5');
  assert.equal(product.category.id, 5);
  assert.ok(Array.isArray(product.reviews));
  assert.ok(Array.isArray(product.inventory));
  assert.ok(product.reviews[0].customer.email.includes('@example.com'));
  assert.ok(product.inventory[0].warehouse.name.startsWith('Warehouse'));

  const order = await requestJson('/api/v1/Orders/1');
  assert.equal(order.customer.id, 1);
  assert.equal(order.shippingAddress.id, 1);
  assert.ok(Array.isArray(order.items));
  assert.equal(order.items[0].product.id, 1);
  assert.equal(order.invoice.id, 1);
  assert.equal(order.shipment.id, 1);

  const customer = await requestJson('/api/v1/Customers/1');
  assert.ok(Array.isArray(customer.orders));
  assert.ok(Array.isArray(customer.carts));
  assert.ok(Array.isArray(customer.wishlists));
  assert.ok(Array.isArray(customer.paymentMethods));
  assert.ok(Array.isArray(customer.addresses));
  assert.ok(Array.isArray(customer.loyaltyAccounts));

  const project = await requestJson('/api/v1/Projects/1');
  assert.equal(project.owner.id, 1);
  assert.ok(Array.isArray(project.tasks));
  assert.equal(project.tasks[0].assignee.id, 1);

  const invoice = await requestJson('/api/v1/Invoices/1');
  assert.ok(Array.isArray(invoice.payments));
  assert.ok(Array.isArray(invoice.items));
  assert.equal(invoice.items[0].product.id, 1);

  const event = await requestJson('/api/v1/Events/1');
  assert.equal(event.venue.id, 1);
  assert.ok(Array.isArray(event.attendees));

  const playlist = await requestJson('/api/v1/Playlists/1');
  assert.ok(Array.isArray(playlist.items));
  assert.ok(playlist.items[0].song);

  const supportTicket = await requestJson('/api/v1/SupportTickets/1');
  assert.equal(supportTicket.customer.id, 1);
  assert.equal(supportTicket.order.id, 1);
  assert.ok(Array.isArray(supportTicket.replies));
});

test('relationship traversal endpoints stay aligned with embedded relationship payloads', async () => {
  const book = await requestJson('/api/v1/Books/3');
  const bookAuthors = await requestJson('/api/v1/Books/3/authors');
  const bookCoverPhotos = await requestJson('/api/v1/Books/3/coverPhotos');
  assert.deepEqual(bookAuthors, book.authors);
  assert.deepEqual(bookCoverPhotos, book.coverPhotos);

  const customer = await requestJson('/api/v1/Customers/1');
  const customerOrders = await requestJson('/api/v1/Customers/1/orders');
  assert.deepEqual(customerOrders, customer.orders);

  const order = await requestJson('/api/v1/Orders/1');
  const orderItems = await requestJson('/api/v1/Orders/1/items');
  assert.deepEqual(orderItems, order.items);

  const product = await requestJson('/api/v1/Products/5');
  const productReviews = await requestJson('/api/v1/Products/5/reviews');
  assert.deepEqual(productReviews, product.reviews);

  const project = await requestJson('/api/v1/Projects/1');
  const projectTasks = await requestJson('/api/v1/Projects/1/tasks');
  assert.deepEqual(projectTasks, project.tasks);
});

test('openapi json exposes the generated API surface including relationship paths', async () => {
  const swagger = await requestJson('/openapi.json');

  assert.equal(swagger.openapi, '3.0.3');
  assert.equal(Object.keys(swagger.components.schemas).length, RESOURCES.length);
  // With 108 resources and dozens of traversal endpoints, we expect a much larger surface.
  assert.ok(Object.keys(swagger.paths).length > 275);
  assert.ok(endpointCount(swagger) > 700);
  
  // Original endpoints
  assert.ok(swagger.paths['/api/v1/Orders/{id}/items']);
  assert.ok(swagger.paths['/api/v1/Customers/{id}/orders']);
  assert.ok(swagger.paths['/api/v1/Products/{id}/reviews']);
  assert.ok(swagger.paths['/api/v1/Projects/{id}/tasks']);
  
  // New endpoints
  assert.ok(swagger.paths['/api/v1/Carts/{id}/items']);
  assert.ok(swagger.paths['/api/v1/Wishlists/{id}/items']);
  assert.ok(swagger.paths['/api/v1/Products/{id}/variants']);
  assert.ok(swagger.paths['/api/v1/Products/{id}/favorites']);
  assert.ok(swagger.paths['/api/v1/Users/{id}/badges']);
  assert.ok(swagger.paths['/api/v1/Hotels/{id}/bookings']);
  assert.ok(swagger.paths['/api/v1/Articles/{id}/tags']);
  assert.ok(swagger.paths['/api/v1/Departments/{id}/employees']);
  assert.ok(swagger.paths['/api/v1/Vendors/{id}/transactions']);
  assert.ok(swagger.paths['/api/v1/Reviews/{id}/replies']);
  assert.ok(swagger.paths['/api/v1/Conversations/{id}/messages']);
  assert.ok(swagger.paths['/api/v1/Orders/{id}/refunds']);
  assert.ok(swagger.paths['/api/v1/Customers/{id}/reviews']);
  assert.ok(swagger.paths['/api/v1/Customers/{id}/paymentMethods']);
  assert.ok(swagger.paths['/api/v1/Customers/{id}/addresses']);
  assert.ok(swagger.paths['/api/v1/Customers/{id}/loyaltyAccounts']);
  assert.ok(swagger.paths['/api/v1/Invoices/{id}/payments']);
  assert.ok(swagger.paths['/api/v1/Invoices/{id}/items']);
  assert.ok(swagger.paths['/api/v1/Flights/{id}/bookings']);
  assert.ok(swagger.paths['/api/v1/SupportTickets/{id}/replies']);
  assert.ok(swagger.paths['/api/v1/Restaurants/{id}/menus']);
  assert.ok(swagger.paths['/api/v1/Suppliers/{id}/products']);
  assert.ok(swagger.paths['/api/v1/Users/{id}/notifications']);

  const productQueryParams = swagger.paths['/api/v1/Products'].get.parameters.map((param: any) => param.name);
  assert.ok(productQueryParams.includes('q'));
  assert.ok(productQueryParams.includes('limit'));

  const booksQueryParams = swagger.paths['/api/v1/Books'].get.parameters.map((param: any) => param.name);
  assert.deepEqual(booksQueryParams, []);

  const customerOrdersParams = swagger.paths['/api/v1/Customers/{id}/orders'].get.parameters.map((param: any) => param.name);
  assert.ok(customerOrdersParams.includes('id'));
  assert.ok(customerOrdersParams.includes('limit'));

  const bookAuthorsParams = swagger.paths['/api/v1/Books/{id}/authors'].get.parameters.map((param: any) => param.name);
  assert.deepEqual(bookAuthorsParams, ['id']);

  assert.ok(swagger.components.schemas.ReviewReply);
  assert.ok(swagger.components.schemas.SearchQuery);
  assert.equal(
    swagger.paths['/api/v1/Reviews/{id}/replies'].get.responses['200'].content['application/json'].schema.items.$ref,
    '#/components/schemas/ReviewReply',
  );
  
  // Original schema references
  assert.ok(swagger.components.schemas.Product.properties.category);
  assert.ok(swagger.components.schemas.Order.properties.items);
  assert.ok(swagger.components.schemas.Customer.properties.paymentMethods);
  assert.ok(swagger.components.schemas.Invoice.properties.payments);
});

test('openapi operation ids stay aligned with registered API routes', async () => {
  const swagger = await requestJson('/openapi.json');
  const routeMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  const seenOperationIds = new Set<string>();
  const toOpenApiPath = (path: string) =>
    path.replace(/\/$/, '').replace(/:([A-Za-z0-9_]+)/g, '{$1}');

  for (const [path, pathItem] of Object.entries(swagger.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = (pathItem as Record<string, { operationId?: unknown } | undefined>)[method];
      if (!operation) continue;

      assert.equal(typeof operation.operationId, 'string', `${method.toUpperCase()} ${path}`);
      const operationId = operation.operationId;
      assert.ok(typeof operationId === 'string');
      assert.ok(!seenOperationIds.has(operationId), operationId);
      seenOperationIds.add(operationId);
    }
  }

  for (const route of app.routes) {
    if (!route.path.startsWith('/api/v1/') || route.path === '/api/v1/_meta') continue;
    if (!routeMethods.has(route.method)) continue;

    const path = toOpenApiPath(route.path);
    const method = route.method.toLowerCase();
    const operation = swagger.paths[path]?.[method];
    assert.ok(operation, `${route.method} ${path} is missing from OpenAPI`);
    assert.equal(operation.operationId, route.operationId, `${route.method} ${path}`);
  }
});

test('expanded relationship endpoints are functional across domains', async () => {
  // Test CartItems
  const cartItems = await requestJson('/api/v1/CartItems');
  assert.ok(Array.isArray(cartItems));
  assert.ok(cartItems.length > 0);
  assert.ok(cartItems[0].product);
  
  // Test Carts with nested items
  const cart = await requestJson('/api/v1/Carts/1');
  assert.ok(Array.isArray(cart.items));
  
  // Test relationship endpoint
  const cartItemsViaRelationship = await requestJson('/api/v1/Carts/1/items');
  assert.ok(Array.isArray(cartItemsViaRelationship));
  assert.deepEqual(cartItemsViaRelationship, cart.items);
  
  // Test Wishlists with nested items
  const wishlist = await requestJson('/api/v1/Wishlists/1');
  assert.ok(Array.isArray(wishlist.items));
  
  // Test UserBadges
  const badges = await requestJson('/api/v1/UserBadges');
  assert.ok(Array.isArray(badges));
  
  // Test Users with badges
  const user = await requestJson('/api/v1/Users/1');
  assert.ok(Array.isArray(user.badges));
  
  // Test Vendors with transactions
  const vendor = await requestJson('/api/v1/Vendors/1');
  assert.ok(Array.isArray(vendor.transactions));
  
  // Test Articles with tags
  const article = await requestJson('/api/v1/Articles/1');
  assert.ok(Array.isArray(article.tags));

  const paymentMethods = await requestJson('/api/v1/Customers/1/paymentMethods');
  assert.ok(Array.isArray(paymentMethods));
  assert.ok(paymentMethods.length > 0);
  assert.equal(paymentMethods[0].customerId, 1);
  assert.ok(paymentMethods[0].customer);

  const customerAddresses = await requestJson('/api/v1/Customers/1/addresses');
  assert.ok(Array.isArray(customerAddresses));
  assert.ok(customerAddresses.length > 0);
  assert.equal(customerAddresses[0].customerId, 1);
  assert.ok(customerAddresses[0].address);

  const invoiceItems = await requestJson('/api/v1/Invoices/1/items');
  assert.ok(Array.isArray(invoiceItems));
  assert.ok(invoiceItems.length > 0);
  assert.equal(invoiceItems[0].invoiceId, 1);
  assert.ok(invoiceItems[0].product);

  const flightBookings = await requestJson('/api/v1/Flights/1/bookings');
  assert.ok(Array.isArray(flightBookings));
  assert.ok(flightBookings.length > 0);
  assert.equal(flightBookings[0].flightId, 1);
  assert.ok(flightBookings[0].customer);

  const restaurantMenus = await requestJson('/api/v1/Restaurants/1/menus');
  assert.ok(Array.isArray(restaurantMenus));
  assert.ok(restaurantMenus.length > 0);
  assert.equal(restaurantMenus[0].restaurantId, 1);

  const menuItems = await requestJson('/api/v1/RestaurantMenus/1/items');
  assert.ok(Array.isArray(menuItems));
  assert.ok(menuItems.length > 0);
  assert.equal(menuItems[0].menuId, 1);

  const ticketReplies = await requestJson('/api/v1/SupportTickets/1/replies');
  assert.ok(Array.isArray(ticketReplies));
  assert.ok(ticketReplies.length > 0);
  assert.equal(ticketReplies[0].ticketId, 1);

  const supplierProducts = await requestJson('/api/v1/Suppliers/1/products');
  assert.ok(Array.isArray(supplierProducts));
  assert.ok(supplierProducts.length > 0);
  assert.equal(supplierProducts[0].supplierId, 1);
  assert.ok(supplierProducts[0].product);

  const loyaltyTransactions = await requestJson('/api/v1/LoyaltyAccounts/1/transactions');
  assert.ok(Array.isArray(loyaltyTransactions));
  assert.ok(loyaltyTransactions.length > 0);
  assert.equal(loyaltyTransactions[0].accountId, 1);
});

test('openapi yaml is served inline and parses to the same API surface as openapi json', async () => {
  const yamlResponse = await request('/openapi.yaml');
  const yamlText = await yamlResponse.text();
  const yamlDoc = parseYaml(yamlText) as Record<string, any>;
  const jsonDoc = await requestJson('/openapi.json');

  assert.equal(yamlResponse.status, 200);
  assert.equal(yamlResponse.headers.get('content-type'), 'text/yaml; charset=utf-8');
  assert.equal(yamlResponse.headers.get('content-disposition'), 'inline; filename="openapi.yaml"');
  assert.equal(yamlResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(yamlDoc.openapi, jsonDoc.openapi);
  assert.equal(Object.keys(yamlDoc.paths).length, Object.keys(jsonDoc.paths).length);
  assert.equal(Object.keys(yamlDoc.components.schemas).length, Object.keys(jsonDoc.components.schemas).length);
  assert.ok(yamlText.includes('/api/v1/Orders/{id}/items'));
});
