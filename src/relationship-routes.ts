export type FilteredRelationshipRoute = {
  path: string;
  tag: string;
  summary: string;
  parentResource: string;
  targetResource: string;
  foreignKey: string;
};

type NestedFromParent = {
  parent: string;
  field: string;
};

type NestedByForeignKey = {
  child: string;
  foreignKey: string;
};

export type NestedRelationshipRoute = {
  path: `/${string}`;
  parentResource: string;
  tag: string;
  operationId: string;
  summary: string;
  responseSchema?: string;
} & (
  | { kind: "fromParent"; spec: NestedFromParent }
  | { kind: "byForeignKey"; spec: NestedByForeignKey }
);

export function operationIdForRelationshipPath(path: string, parent: string, target: string): string {
  const tail = path.split("/").pop() ?? target.toLowerCase();
  return `get_${parent}_${tail}`;
}

function fromParent(
  path: `/${string}`,
  parent: string,
  field: string,
  tag: string,
  operationId: string,
  summary: string,
  responseSchema?: string,
): NestedRelationshipRoute {
  return {
    kind: "fromParent",
    path,
    parentResource: parent,
    tag,
    operationId,
    summary,
    ...(responseSchema ? { responseSchema } : {}),
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
  responseSchema?: string,
): NestedRelationshipRoute {
  return {
    kind: "byForeignKey",
    path,
    parentResource: parent,
    tag,
    operationId,
    summary,
    ...(responseSchema ? { responseSchema } : {}),
    spec: { child, foreignKey },
  };
}

export const QUERYABLE_RESOURCES = new Set([
  'Products',
  'Orders',
  'Customers',
  'Users',
  'Articles',
  'Posts',
  'Reviews',
  'Events',
  'Hotels',
  'Bookings',
  'Flights',
  'Restaurants',
  'Invoices',
  'Payments',
  'Transactions',
  'SupportTickets',
  'SearchQueries',
  'Notifications',
  'Logs',
]);

export const QUERYABLE_RELATIONSHIP_PATHS = new Set([
  '/api/v1/Customers/{id}/orders',
  '/api/v1/Customers/{id}/reviews',
  '/api/v1/Customers/{id}/paymentMethods',
  '/api/v1/Customers/{id}/addresses',
  '/api/v1/Orders/{id}/items',
  '/api/v1/Orders/{id}/returns',
  '/api/v1/Orders/{id}/notes',
  '/api/v1/Products/{id}/reviews',
  '/api/v1/Products/{id}/inventory',
  '/api/v1/Products/{id}/variants',
  '/api/v1/Invoices/{id}/payments',
  '/api/v1/Invoices/{id}/items',
  '/api/v1/SupportTickets/{id}/replies',
]);

export const NESTED_RELATIONSHIP_ROUTES: NestedRelationshipRoute[] = [
  fromParent(
    '/api/v1/Books/:id/authors',
    'Books',
    'authors',
    'Books',
    'getBookAuthors',
    'List related authors for a given book id',
    'Author',
  ),
  fromParent(
    '/api/v1/Books/:id/coverPhotos',
    'Books',
    'coverPhotos',
    'Books',
    'getBookCoverPhotos',
    'List related cover photos for a given book id',
    'CoverPhoto',
  ),
  fromParent(
    '/api/v1/Customers/:id/orders',
    'Customers',
    'orders',
    'Customers',
    'getCustomerOrders',
    'List related orders for a given customer id',
  ),
  fromParent(
    '/api/v1/Orders/:id/items',
    'Orders',
    'items',
    'Orders',
    'getOrderItems',
    'List related order items for a given order id',
  ),
  fromParent(
    '/api/v1/Products/:id/reviews',
    'Products',
    'reviews',
    'Products',
    'getProductReviews',
    'List related reviews for a given product id',
  ),
  fromParent(
    '/api/v1/Projects/:id/tasks',
    'Projects',
    'tasks',
    'Projects',
    'getProjectTasks',
    'List related tasks for a given project id',
  ),
  fromParent(
    '/api/v1/Carts/:id/items',
    'Carts',
    'items',
    'Carts',
    'getCartItems',
    'List related cart items for a given cart id',
    'CartItem',
  ),
  fromParent(
    '/api/v1/Wishlists/:id/items',
    'Wishlists',
    'items',
    'Wishlists',
    'getWishlistItems',
    'List related wishlist items for a given wishlist id',
    'WishlistItem',
  ),
  fromParent(
    '/api/v1/Hotels/:id/bookings',
    'Hotels',
    'bookings',
    'Hotels',
    'getHotelBookings',
    'List related bookings for a given hotel id',
    'Booking',
  ),
  fromParent(
    '/api/v1/Articles/:id/tags',
    'Articles',
    'tags',
    'Articles',
    'getArticleTags',
    'List related tags for a given article id',
    'ArticleTag',
  ),
  fromParent(
    '/api/v1/Departments/:id/employees',
    'Departments',
    'employees',
    'Departments',
    'getDepartmentEmployees',
    'List related employees for a given department id',
    'Employee',
  ),
  fromParent(
    '/api/v1/Vendors/:id/transactions',
    'Vendors',
    'transactions',
    'Vendors',
    'getVendorTransactions',
    'List related transactions for a given vendor id',
    'Transaction',
  ),
  fromParent(
    '/api/v1/Reviews/:id/replies',
    'Reviews',
    'replies',
    'Reviews',
    'getReviewReplies',
    'List related replies for a given review id',
    'ReviewReply',
  ),
  fromParent(
    '/api/v1/Conversations/:id/messages',
    'Conversations',
    'messages',
    'Conversations',
    'getConversationMessages',
    'List related messages for a given conversation id',
    'Message',
  ),
  byForeignKey(
    '/api/v1/Products/:id/variants',
    'Products',
    'ProductVariants',
    'productId',
    'Products',
    'getProductVariants',
    'List related variants for a given product id',
    'ProductVariant',
  ),
  byForeignKey(
    '/api/v1/Products/:id/favorites',
    'Products',
    'Favorites',
    'productId',
    'Products',
    'getProductFavorites',
    'List related favorites for a given product id',
    'Favorite',
  ),
  byForeignKey(
    '/api/v1/Users/:id/badges',
    'Users',
    'UserBadges',
    'userId',
    'Users',
    'getUserBadges',
    'List related badges for a given user id',
    'UserBadge',
  ),
  byForeignKey(
    '/api/v1/Orders/:id/refunds',
    'Orders',
    'Refunds',
    'orderId',
    'Orders',
    'getOrderRefunds',
    'List related refunds for a given order id',
    'Refund',
  ),
  byForeignKey(
    '/api/v1/Customers/:id/reviews',
    'Customers',
    'Reviews',
    'customerId',
    'Customers',
    'getCustomerReviews',
    'List related reviews for a given customer id',
    'Review',
  ),
];

export const ADDITIONAL_RELATIONSHIP_ROUTES: FilteredRelationshipRoute[] = [
  { path: '/api/v1/Customers/{id}/carts', tag: 'Customers', summary: 'List related carts for a given customer id', parentResource: 'Customers', targetResource: 'Carts', foreignKey: 'customerId' },
  { path: '/api/v1/Customers/{id}/wishlists', tag: 'Customers', summary: 'List related wishlists for a given customer id', parentResource: 'Customers', targetResource: 'Wishlists', foreignKey: 'customerId' },
  { path: '/api/v1/Customers/{id}/paymentMethods', tag: 'Customers', summary: 'List related payment methods for a given customer id', parentResource: 'Customers', targetResource: 'PaymentMethods', foreignKey: 'customerId' },
  { path: '/api/v1/Customers/{id}/addresses', tag: 'Customers', summary: 'List related customer addresses for a given customer id', parentResource: 'Customers', targetResource: 'CustomerAddresses', foreignKey: 'customerId' },
  { path: '/api/v1/Customers/{id}/loyaltyAccounts', tag: 'Customers', summary: 'List related loyalty accounts for a given customer id', parentResource: 'Customers', targetResource: 'LoyaltyAccounts', foreignKey: 'customerId' },
  { path: '/api/v1/Employees/{id}/projects', tag: 'Employees', summary: 'List related projects for a given employee id', parentResource: 'Employees', targetResource: 'Projects', foreignKey: 'ownerId' },
  { path: '/api/v1/Employees/{id}/skills', tag: 'Employees', summary: 'List related skills for a given employee id', parentResource: 'Employees', targetResource: 'EmployeeSkills', foreignKey: 'employeeId' },
  { path: '/api/v1/Posts/{id}/comments', tag: 'Posts', summary: 'List related comments for a given post id', parentResource: 'Posts', targetResource: 'Comments', foreignKey: 'postId' },
  { path: '/api/v1/Events/{id}/tickets', tag: 'Events', summary: 'List related tickets for a given event id', parentResource: 'Events', targetResource: 'Tickets', foreignKey: 'eventId' },
  { path: '/api/v1/Events/{id}/attendees', tag: 'Events', summary: 'List related attendees for a given event id', parentResource: 'Events', targetResource: 'EventAttendees', foreignKey: 'eventId' },
  { path: '/api/v1/Playlists/{id}/items', tag: 'Playlists', summary: 'List related playlist items for a given playlist id', parentResource: 'Playlists', targetResource: 'PlaylistItems', foreignKey: 'playlistId' },
  { path: '/api/v1/Artists/{id}/albums', tag: 'Artists', summary: 'List related albums for a given artist id', parentResource: 'Artists', targetResource: 'Albums', foreignKey: 'artistId' },
  { path: '/api/v1/Artists/{id}/songs', tag: 'Artists', summary: 'List related songs for a given artist id', parentResource: 'Artists', targetResource: 'Songs', foreignKey: 'artistId' },
  { path: '/api/v1/Albums/{id}/songs', tag: 'Albums', summary: 'List related songs for a given album id', parentResource: 'Albums', targetResource: 'Songs', foreignKey: 'albumId' },
  { path: '/api/v1/Genres/{id}/movies', tag: 'Genres', summary: 'List related movies for a given genre id', parentResource: 'Genres', targetResource: 'Movies', foreignKey: 'genreId' },
  { path: '/api/v1/Genres/{id}/songs', tag: 'Genres', summary: 'List related songs for a given genre id', parentResource: 'Genres', targetResource: 'Songs', foreignKey: 'genreId' },
  { path: '/api/v1/Countries/{id}/cities', tag: 'Countries', summary: 'List related cities for a given country id', parentResource: 'Countries', targetResource: 'Cities', foreignKey: 'countryId' },
  { path: '/api/v1/Warehouses/{id}/inventories', tag: 'Warehouses', summary: 'List related inventories for a given warehouse id', parentResource: 'Warehouses', targetResource: 'Inventories', foreignKey: 'warehouseId' },
  { path: '/api/v1/Invoices/{id}/payments', tag: 'Invoices', summary: 'List related payments for a given invoice id', parentResource: 'Invoices', targetResource: 'Payments', foreignKey: 'invoiceId' },
  { path: '/api/v1/Invoices/{id}/items', tag: 'Invoices', summary: 'List related invoice items for a given invoice id', parentResource: 'Invoices', targetResource: 'InvoiceItems', foreignKey: 'invoiceId' },
  { path: '/api/v1/Plans/{id}/subscriptions', tag: 'Plans', summary: 'List related subscriptions for a given plan id', parentResource: 'Plans', targetResource: 'Subscriptions', foreignKey: 'planId' },
  { path: '/api/v1/Users/{id}/favorites', tag: 'Users', summary: 'List related favorites for a given user id', parentResource: 'Users', targetResource: 'Favorites', foreignKey: 'userId' },
  { path: '/api/v1/Users/{id}/notifications', tag: 'Users', summary: 'List related notifications for a given user id', parentResource: 'Users', targetResource: 'Notifications', foreignKey: 'userId' },
  { path: '/api/v1/Users/{id}/sessions', tag: 'Users', summary: 'List related sessions for a given user id', parentResource: 'Users', targetResource: 'Sessions', foreignKey: 'userId' },
  { path: '/api/v1/Users/{id}/pageViews', tag: 'Users', summary: 'List related page views for a given user id', parentResource: 'Users', targetResource: 'PageViews', foreignKey: 'userId' },
  { path: '/api/v1/Users/{id}/activities', tag: 'Users', summary: 'List related activities for a given user id', parentResource: 'Users', targetResource: 'UserActivity', foreignKey: 'userId' },
  { path: '/api/v1/Users/{id}/searchQueries', tag: 'Users', summary: 'List related search queries for a given user id', parentResource: 'Users', targetResource: 'SearchQueries', foreignKey: 'userId' },
  { path: '/api/v1/Products/{id}/inventory', tag: 'Products', summary: 'List related inventory records for a given product id', parentResource: 'Products', targetResource: 'Inventories', foreignKey: 'productId' },
  { path: '/api/v1/Products/{id}/orderItems', tag: 'Products', summary: 'List related order items for a given product id', parentResource: 'Products', targetResource: 'OrderItems', foreignKey: 'productId' },
  { path: '/api/v1/Products/{id}/supplierProducts', tag: 'Products', summary: 'List related supplier product offers for a given product id', parentResource: 'Products', targetResource: 'SupplierProducts', foreignKey: 'productId' },
  { path: '/api/v1/Orders/{id}/returns', tag: 'Orders', summary: 'List related returns for a given order id', parentResource: 'Orders', targetResource: 'Returns', foreignKey: 'orderId' },
  { path: '/api/v1/Orders/{id}/notes', tag: 'Orders', summary: 'List related notes for a given order id', parentResource: 'Orders', targetResource: 'OrderNotes', foreignKey: 'orderId' },
  { path: '/api/v1/Orders/{id}/couponUsages', tag: 'Orders', summary: 'List related coupon usages for a given order id', parentResource: 'Orders', targetResource: 'CouponUsages', foreignKey: 'orderId' },
  { path: '/api/v1/Shipments/{id}/events', tag: 'Shipments', summary: 'List related shipment events for a given shipment id', parentResource: 'Shipments', targetResource: 'ShipmentEvents', foreignKey: 'shipmentId' },
  { path: '/api/v1/Flights/{id}/bookings', tag: 'Flights', summary: 'List related flight bookings for a given flight id', parentResource: 'Flights', targetResource: 'FlightBookings', foreignKey: 'flightId' },
  { path: '/api/v1/Companies/{id}/offices', tag: 'Companies', summary: 'List related offices for a given company id', parentResource: 'Companies', targetResource: 'CompanyOffices', foreignKey: 'companyId' },
  { path: '/api/v1/Recipes/{id}/ingredients', tag: 'Recipes', summary: 'List related ingredients for a given recipe id', parentResource: 'Recipes', targetResource: 'RecipeIngredients', foreignKey: 'recipeId' },
  { path: '/api/v1/Restaurants/{id}/menus', tag: 'Restaurants', summary: 'List related menus for a given restaurant id', parentResource: 'Restaurants', targetResource: 'RestaurantMenus', foreignKey: 'restaurantId' },
  { path: '/api/v1/RestaurantMenus/{id}/items', tag: 'RestaurantMenus', summary: 'List related menu items for a given menu id', parentResource: 'RestaurantMenus', targetResource: 'MenuItems', foreignKey: 'menuId' },
  { path: '/api/v1/Promotions/{id}/products', tag: 'Promotions', summary: 'List related promotion products for a given promotion id', parentResource: 'Promotions', targetResource: 'PromotionProducts', foreignKey: 'promotionId' },
  { path: '/api/v1/Banners/{id}/placements', tag: 'Banners', summary: 'List related banner placements for a given banner id', parentResource: 'Banners', targetResource: 'BannerPlacements', foreignKey: 'bannerId' },
  { path: '/api/v1/LoyaltyAccounts/{id}/transactions', tag: 'LoyaltyAccounts', summary: 'List related loyalty transactions for a given account id', parentResource: 'LoyaltyAccounts', targetResource: 'LoyaltyTransactions', foreignKey: 'accountId' },
  { path: '/api/v1/SupportTickets/{id}/replies', tag: 'SupportTickets', summary: 'List related replies for a given support ticket id', parentResource: 'SupportTickets', targetResource: 'TicketReplies', foreignKey: 'ticketId' },
  { path: '/api/v1/Suppliers/{id}/products', tag: 'Suppliers', summary: 'List related supplier product offers for a given supplier id', parentResource: 'Suppliers', targetResource: 'SupplierProducts', foreignKey: 'supplierId' },
];
