import type { App } from "@daloyjs/core";

import {
  ADDITIONAL_RELATIONSHIP_ROUTES,
  QUERYABLE_RELATIONSHIP_PATHS,
} from "../../relationship-routes.js";
import type { Sample } from "../../resources.js";
import { collectionResponse, notFoundJson } from "../../shared/http.js";
import { getById, listFor, resourceNamed } from "../../shared/resources.js";

interface NestedFromParent {
  parent: string;
  field: string;
}

interface NestedByForeignKey {
  child: string;
  foreignKey: string;
}

type NestedRoute = {
  path: `/${string}`;
  oasPath: string;
  parentResource: string;
  tag: string;
  operationId: string;
  summary: string;
} & ({ kind: "fromParent"; spec: NestedFromParent } | { kind: "byForeignKey"; spec: NestedByForeignKey });

function pathToOasPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function fromParent(
  path: `/${string}`,
  parent: string,
  field: string,
  tag: string,
  operationId: string,
  summary: string,
): NestedRoute {
  return {
    kind: "fromParent",
    path,
    oasPath: pathToOasPath(path),
    parentResource: parent,
    tag,
    operationId,
    summary,
    spec: { parent, field },
  };
}

function byForeignKey(
  path: `/${string}`,
  parent: string,
  child: string,
  foreignKey: string,
  tag: string,
  operationId: string,
  summary: string,
): NestedRoute {
  return {
    kind: "byForeignKey",
    path,
    oasPath: pathToOasPath(path),
    parentResource: parent,
    tag,
    operationId,
    summary,
    spec: { child, foreignKey },
  };
}

function relationshipCollectionResponse(
  ctxHeaders: Headers,
  url: string,
  oasPath: string,
  items: Sample[],
): Sample[] {
  return QUERYABLE_RELATIONSHIP_PATHS.has(oasPath)
    ? collectionResponse(ctxHeaders, url, items)
    : items;
}

function opIdFor(path: string, parent: string, target: string): string {
  const tail = path.split("/").pop() ?? target.toLowerCase();
  return `get_${parent}_${tail}`;
}

const NESTED_ROUTES: NestedRoute[] = [
  fromParent("/api/v1/Books/:id/authors", "Books", "authors", "Books", "getBookAuthors", "List related authors for a given book id"),
  fromParent("/api/v1/Books/:id/coverPhotos", "Books", "coverPhotos", "Books", "getBookCoverPhotos", "List related cover photos for a given book id"),
  fromParent("/api/v1/Customers/:id/orders", "Customers", "orders", "Customers", "getCustomerOrders", "List related orders for a given customer id"),
  fromParent("/api/v1/Orders/:id/items", "Orders", "items", "Orders", "getOrderItems", "List related order items for a given order id"),
  fromParent("/api/v1/Products/:id/reviews", "Products", "reviews", "Products", "getProductReviews", "List related reviews for a given product id"),
  fromParent("/api/v1/Projects/:id/tasks", "Projects", "tasks", "Projects", "getProjectTasks", "List related tasks for a given project id"),
  fromParent("/api/v1/Carts/:id/items", "Carts", "items", "Carts", "getCartItems", "List related cart items for a given cart id"),
  fromParent("/api/v1/Wishlists/:id/items", "Wishlists", "items", "Wishlists", "getWishlistItems", "List related wishlist items for a given wishlist id"),
  fromParent("/api/v1/Hotels/:id/bookings", "Hotels", "bookings", "Hotels", "getHotelBookings", "List related bookings for a given hotel id"),
  fromParent("/api/v1/Articles/:id/tags", "Articles", "tags", "Articles", "getArticleTags", "List related tags for a given article id"),
  fromParent("/api/v1/Departments/:id/employees", "Departments", "employees", "Departments", "getDepartmentEmployees", "List related employees for a given department id"),
  fromParent("/api/v1/Vendors/:id/transactions", "Vendors", "transactions", "Vendors", "getVendorTransactions", "List related transactions for a given vendor id"),
  fromParent("/api/v1/Reviews/:id/replies", "Reviews", "replies", "Reviews", "getReviewReplies", "List related replies for a given review id"),
  fromParent("/api/v1/Conversations/:id/messages", "Conversations", "messages", "Conversations", "getConversationMessages", "List related messages for a given conversation id"),
  byForeignKey("/api/v1/Products/:id/variants", "Products", "ProductVariants", "productId", "Products", "getProductVariants", "List related variants for a given product id"),
  byForeignKey("/api/v1/Products/:id/favorites", "Products", "Favorites", "productId", "Products", "getProductFavorites", "List related favorites for a given product id"),
  byForeignKey("/api/v1/Users/:id/badges", "Users", "UserBadges", "userId", "Users", "getUserBadges", "List related badges for a given user id"),
  byForeignKey("/api/v1/Orders/:id/refunds", "Orders", "Refunds", "orderId", "Orders", "getOrderRefunds", "List related refunds for a given order id"),
  byForeignKey("/api/v1/Customers/:id/reviews", "Customers", "Reviews", "customerId", "Customers", "getCustomerReviews", "List related reviews for a given customer id"),
];

export const relationshipsModule = {
  name: "relationships",
  register(api: App) {
    api.route({
      method: "GET",
      path: "/api/v1/Authors/authors/books/:idBook",
      operationId: "getAuthorsForBook",
      tags: ["Authors"],
      summary: "List authors for a given book id",
      responses: { 200: { description: "Success" } },
      handler: async ({ params }) => {
        const idBook = Number((params as { idBook: string }).idBook);
        const def = resourceNamed("Authors");
        const all = listFor(def) as Array<Sample & { idBook: number }>;
        return { status: 200 as const, body: all.filter((author) => author.idBook === idBook) };
      },
    });

    api.route({
      method: "GET",
      path: "/api/v1/CoverPhotos/books/covers/:idBook",
      operationId: "getCoverPhotosForBook",
      tags: ["CoverPhotos"],
      summary: "List cover photos for a given book id",
      responses: { 200: { description: "Success" } },
      handler: async ({ params }) => {
        const idBook = Number((params as { idBook: string }).idBook);
        const def = resourceNamed("CoverPhotos");
        const all = listFor(def) as Array<Sample & { idBook: number }>;
        return { status: 200 as const, body: all.filter((photo) => photo.idBook === idBook) };
      },
    });

    for (const route of NESTED_ROUTES) {
      api.route({
        method: "GET",
        path: route.path,
        operationId: route.operationId,
        tags: [route.tag],
        summary: route.summary,
        responses: {
          200: { description: "Success" },
          404: { description: "Not Found" },
        },
        handler: async ({ params, request, set }) => {
          const id = Number((params as { id: string }).id);
          const parent = getById(resourceNamed(route.parentResource), id);
          if (!parent) return notFoundJson();

          let items: Sample[];
          if (route.kind === "fromParent") {
            items = (parent[route.spec.field] as Sample[]) ?? [];
          } else {
            const target = resourceNamed(route.spec.child);
            const all = listFor(target) as Array<Sample & Record<string, unknown>>;
            items = all.filter((item) => item[route.spec.foreignKey] === id);
          }

          const body = relationshipCollectionResponse(
            set.headers,
            request.url,
            route.oasPath,
            items,
          );
          return { status: 200 as const, body };
        },
      });
    }

    for (const route of ADDITIONAL_RELATIONSHIP_ROUTES) {
      const path = route.path.replace(/\{id\}/g, ":id") as `/${string}`;
      api.route({
        method: "GET",
        path,
        operationId: opIdFor(route.path, route.parentResource, route.targetResource),
        tags: [route.tag],
        summary: route.summary,
        responses: {
          200: { description: "Success" },
          404: { description: "Not Found" },
        },
        handler: async ({ params, request, set }) => {
          const id = Number((params as { id: string }).id);
          const parent = getById(resourceNamed(route.parentResource), id);
          if (!parent) return notFoundJson();

          const target = resourceNamed(route.targetResource);
          const all = listFor(target) as Array<Sample & Record<string, unknown>>;
          const items = all.filter((item) => item[route.foreignKey] === id);
          const body = relationshipCollectionResponse(set.headers, request.url, route.path, items);
          return { status: 200 as const, body };
        },
      });
    }
  },
};