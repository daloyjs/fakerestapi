// Catalog of resources exposed by the fake REST API.
// Each resource yields 6 standard CRUD endpoints (list, get, post, put, patch, delete).
// `sample(i)` deterministically produces the i-th item — used for both seeded GET
// responses and OpenAPI schema inference. Mutations are not persisted.

export type Sample = Record<string, unknown>;

export type ResourceDef = {
  /** PascalCase, used in URL path: /api/v1/{name} */
  name: string;
  /** Human description for OpenAPI tag */
  description: string;
  /** Generates the i-th deterministic sample (i = 1..count) */
  sample: (i: number) => Sample;
  /** How many seeded items GET / list returns. Defaults to 10. */
  count?: number;
};

export const BASE_DEFAULT_COUNT = 10;
export const SAMPLE_SIZE_MULTIPLIER = 3;

export function seededCountFor(def?: ResourceDef): number {
  return (def?.count ?? BASE_DEFAULT_COUNT) * SAMPLE_SIZE_MULTIPLIER;
}

const iso = (i: number, monthOffset = 0) =>
  new Date(Date.UTC(2024, monthOffset, ((i - 1) % 28) + 1, 12, 0, 0)).toISOString();
const lorem = (i: number, prefix: string) =>
  `${prefix} ${i} - ${'lorem ipsum dolor sit amet consectetur adipiscing elit'.repeat(2)}`;
const pick = <T>(arr: readonly T[], i: number) => arr[(i - 1) % arr.length];

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'] as const;
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
const STATUSES = ['pending', 'active', 'completed', 'cancelled', 'archived'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'PHP', 'AUD', 'CAD', 'CHF'] as const;
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Japan', 'Philippines', 'Australia'] as const;
const CITIES = ['New York', 'London', 'Tokyo', 'Paris', 'Manila', 'Sydney', 'Berlin', 'Toronto'] as const;
const FIRST = ['John', 'Jane', 'Alex', 'Maria', 'Liam', 'Olivia', 'Noah', 'Emma', 'Lucas', 'Mia'] as const;
const LAST = ['Smith', 'Johnson', 'Garcia', 'Lee', 'Brown', 'Davis', 'Miller', 'Wilson'] as const;

export const RESOURCES: ResourceDef[] = [
  // ---- Original fakerestapi resources ----
  {
    name: 'Activities',
    description: 'Tasks/activities with due dates',
    sample: (i) => ({ id: i, title: `Activity ${i}`, dueDate: iso(i), completed: i % 2 === 0 }),
  },
  {
    name: 'Authors',
    description: 'Authors of books',
    sample: (i) => ({ id: i, idBook: ((i - 1) % 200) + 1, firstName: `First Name ${i}`, lastName: `Last Name ${i}` }),
  },
  {
    name: 'Books',
    description: 'Books catalog',
    sample: (i) => ({ id: i, title: `Book ${i}`, description: lorem(i, 'Book'), pageCount: i * 100, excerpt: lorem(i, 'Excerpt'), publishDate: iso(i) }),
  },
  {
    name: 'CoverPhotos',
    description: 'Cover photos for books',
    sample: (i) => ({ id: i, idBook: i, url: `https://placehold.co/600x400?text=Cover+${i}` }),
  },
  {
    name: 'Users',
    description: 'Application users',
    sample: (i) => ({ id: i, userName: `User ${i}`, password: `Password${i}` }),
  },

  // ---- Extended resources ----
  {
    name: 'Products',
    description: 'Sellable products',
    sample: (i) => ({ id: i, sku: `SKU-${1000 + i}`, name: `Product ${i}`, description: lorem(i, 'Product'), price: 9.99 + i, stock: i * 3, color: pick(COLORS, i), size: pick(SIZES, i), categoryId: ((i - 1) % 20) + 1, brandId: ((i - 1) % 15) + 1 }),
  },
  {
    name: 'Categories',
    description: 'Product categories',
    sample: (i) => ({ id: i, name: `Category ${i}`, slug: `category-${i}`, parentId: i > 5 ? i - 5 : null, description: lorem(i, 'Category') }),
  },
  {
    name: 'Orders',
    description: 'Customer orders',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, orderDate: iso(i), status: pick(STATUSES, i), total: 100 + i * 15.5, currency: pick(CURRENCY_CODES, i), shippingAddressId: i }),
  },
  {
    name: 'OrderItems',
    description: 'Items belonging to an order',
    sample: (i) => ({ id: i, orderId: ((i - 1) % 30) + 1, productId: ((i - 1) % 50) + 1, quantity: (i % 5) + 1, unitPrice: 9.99 + i, discount: (i % 3) * 1.5 }),
  },
  {
    name: 'Customers',
    description: 'Customers / buyers',
    sample: (i) => ({ id: i, firstName: pick(FIRST, i), lastName: pick(LAST, i), email: `customer${i}@example.com`, phone: `+1-555-01${String(i).padStart(2, '0')}`, registeredAt: iso(i) }),
  },
  {
    name: 'Employees',
    description: 'Company employees',
    sample: (i) => ({ id: i, firstName: pick(FIRST, i), lastName: pick(LAST, i), email: `employee${i}@corp.example`, departmentId: ((i - 1) % 10) + 1, salary: 40000 + i * 1500, hiredAt: iso(i), managerId: i > 1 ? ((i - 2) % 5) + 1 : null }),
  },
  {
    name: 'Departments',
    description: 'Company departments',
    sample: (i) => ({ id: i, name: `Department ${i}`, code: `D${String(i).padStart(3, '0')}`, headEmployeeId: i, budget: 100000 + i * 25000 }),
  },
  {
    name: 'Companies',
    description: 'Companies / organizations',
    sample: (i) => ({ id: i, name: `Company ${i}`, industry: pick(['Tech', 'Finance', 'Retail', 'Health', 'Education'], i), founded: 1980 + (i % 40), website: `https://company${i}.example` }),
  },
  {
    name: 'Projects',
    description: 'Projects',
    sample: (i) => ({ id: i, name: `Project ${i}`, description: lorem(i, 'Project'), status: pick(STATUSES, i), startDate: iso(i), endDate: iso(i + 30), ownerId: ((i - 1) % 20) + 1 }),
  },
  {
    name: 'Tasks',
    description: 'Project tasks',
    sample: (i) => ({ id: i, projectId: ((i - 1) % 25) + 1, title: `Task ${i}`, description: lorem(i, 'Task'), priority: pick(PRIORITIES, i), status: pick(STATUSES, i), dueDate: iso(i + 7), assigneeId: ((i - 1) % 30) + 1 }),
  },
  {
    name: 'Tags',
    description: 'Tags',
    sample: (i) => ({ id: i, name: `tag-${i}`, color: pick(COLORS, i) }),
  },
  {
    name: 'Comments',
    description: 'User comments',
    sample: (i) => ({ id: i, postId: ((i - 1) % 50) + 1, authorId: ((i - 1) % 30) + 1, body: lorem(i, 'Comment'), createdAt: iso(i) }),
  },
  {
    name: 'Posts',
    description: 'Blog posts',
    sample: (i) => ({ id: i, title: `Post ${i}`, body: lorem(i, 'Post body'), authorId: ((i - 1) % 20) + 1, publishedAt: iso(i), tags: [`tag-${i}`, `tag-${i + 1}`] }),
  },
  {
    name: 'Articles',
    description: 'Articles',
    sample: (i) => ({ id: i, title: `Article ${i}`, slug: `article-${i}`, content: lorem(i, 'Article'), authorId: ((i - 1) % 20) + 1, publishedAt: iso(i), readTime: 3 + (i % 15) }),
  },
  {
    name: 'Reviews',
    description: 'Product / service reviews',
    sample: (i) => ({ id: i, productId: ((i - 1) % 50) + 1, customerId: ((i - 1) % 50) + 1, rating: (i % 5) + 1, title: `Review ${i}`, body: lorem(i, 'Review'), createdAt: iso(i) }),
  },
  {
    name: 'Notifications',
    description: 'User notifications',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, message: `Notification ${i}: ${lorem(i, 'msg')}`, read: i % 3 === 0, createdAt: iso(i) }),
  },
  {
    name: 'Events',
    description: 'Calendar events',
    sample: (i) => ({ id: i, name: `Event ${i}`, description: lorem(i, 'Event'), location: pick(CITIES, i), startTime: iso(i), endTime: iso(i + 1), capacity: 50 + i * 10 }),
  },
  {
    name: 'Tickets',
    description: 'Event / support tickets',
    sample: (i) => ({ id: i, eventId: ((i - 1) % 30) + 1, holderName: `${pick(FIRST, i)} ${pick(LAST, i)}`, seat: `Row ${1 + (i % 20)} Seat ${1 + (i % 30)}`, price: 49.99 + i, status: pick(STATUSES, i) }),
  },
  {
    name: 'Venues',
    description: 'Event venues',
    sample: (i) => ({ id: i, name: `Venue ${i}`, address: `${100 + i} Main St`, city: pick(CITIES, i), capacity: 500 + i * 100 }),
  },
  {
    name: 'Cities',
    description: 'Cities',
    sample: (i) => ({ id: i, name: pick(CITIES, i), countryId: ((i - 1) % COUNTRIES.length) + 1, population: 100000 + i * 5000, latitude: -90 + (i % 180), longitude: -180 + (i * 3 % 360) }),
  },
  {
    name: 'Countries',
    description: 'Countries',
    sample: (i) => ({ id: i, name: pick(COUNTRIES, i), code: `C${String(i).padStart(2, '0')}`, currencyCode: pick(CURRENCY_CODES, i) }),
  },
  {
    name: 'Addresses',
    description: 'Postal addresses',
    sample: (i) => ({ id: i, line1: `${100 + i} Main Street`, line2: `Apt ${i}`, city: pick(CITIES, i), state: `State ${(i % 50) + 1}`, postalCode: String(10000 + i), country: pick(COUNTRIES, i) }),
  },
  {
    name: 'Suppliers',
    description: 'Suppliers',
    sample: (i) => ({ id: i, name: `Supplier ${i}`, contactEmail: `supplier${i}@example.com`, phone: `+1-555-02${String(i).padStart(2, '0')}`, country: pick(COUNTRIES, i) }),
  },
  {
    name: 'Warehouses',
    description: 'Warehouses',
    sample: (i) => ({ id: i, name: `Warehouse ${i}`, location: pick(CITIES, i), capacity: 10000 + i * 500 }),
  },
  {
    name: 'Inventories',
    description: 'Stock per warehouse / product',
    sample: (i) => ({ id: i, productId: ((i - 1) % 50) + 1, warehouseId: ((i - 1) % 10) + 1, quantity: 50 + i * 7, lastChecked: iso(i) }),
  },
  {
    name: 'Shipments',
    description: 'Shipments',
    sample: (i) => ({ id: i, orderId: ((i - 1) % 30) + 1, trackingNumber: `TRK${String(i).padStart(8, '0')}`, carrier: pick(['DHL', 'FedEx', 'UPS', 'USPS'], i), shippedAt: iso(i), deliveredAt: iso(i + 3), status: pick(STATUSES, i) }),
  },
  {
    name: 'Invoices',
    description: 'Invoices',
    sample: (i) => ({ id: i, orderId: ((i - 1) % 30) + 1, number: `INV-${String(2024000 + i)}`, issueDate: iso(i), dueDate: iso(i + 30), amount: 250 + i * 12.5, currency: pick(CURRENCY_CODES, i), paid: i % 2 === 0 }),
  },
  {
    name: 'Payments',
    description: 'Payments',
    sample: (i) => ({ id: i, invoiceId: ((i - 1) % 30) + 1, amount: 100 + i * 5.25, currency: pick(CURRENCY_CODES, i), method: pick(['card', 'paypal', 'bank', 'crypto'], i), paidAt: iso(i) }),
  },
  {
    name: 'Coupons',
    description: 'Discount coupons',
    sample: (i) => ({ id: i, code: `SAVE${String(i).padStart(4, '0')}`, percentage: (i % 50) + 5, validFrom: iso(i), validTo: iso(i + 30), active: i % 2 === 0 }),
  },
  {
    name: 'Carts',
    description: 'Shopping carts',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, createdAt: iso(i), updatedAt: iso(i + 1), itemCount: (i % 8) + 1 }),
  },
  {
    name: 'Wishlists',
    description: 'Customer wishlists',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, name: `Wishlist ${i}`, productIds: [i, i + 1, i + 2] }),
  },
  {
    name: 'Subscriptions',
    description: 'Subscription instances',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, planId: ((i - 1) % 5) + 1, startedAt: iso(i), renewsAt: iso(i + 30), status: pick(STATUSES, i) }),
  },
  {
    name: 'Plans',
    description: 'Subscription plans',
    sample: (i) => ({ id: i, name: `Plan ${i}`, price: 9.99 * i, interval: pick(['month', 'year'], i), features: [`feature-${i}`, `feature-${i + 1}`] }),
  },
  {
    name: 'Roles',
    description: 'User roles',
    sample: (i) => ({ id: i, name: pick(['admin', 'editor', 'viewer', 'manager', 'guest'], i), description: lorem(i, 'Role') }),
  },
  {
    name: 'Permissions',
    description: 'Granular permissions',
    sample: (i) => ({ id: i, code: `perm.${i}.read`, description: lorem(i, 'Permission') }),
  },
  {
    name: 'Sessions',
    description: 'Auth sessions',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, token: `tok_${i}_${Math.abs(Math.sin(i) * 1e9 | 0)}`, createdAt: iso(i), expiresAt: iso(i + 1), ip: `192.168.1.${i}` }),
  },
  {
    name: 'Logs',
    description: 'Application logs',
    sample: (i) => ({ id: i, level: pick(['INFO', 'WARN', 'ERROR', 'DEBUG'], i), message: `Log entry ${i}`, timestamp: iso(i), source: `service-${(i % 5) + 1}` }),
  },
  {
    name: 'Files',
    description: 'Uploaded files',
    sample: (i) => ({ id: i, name: `file-${i}.pdf`, mimeType: 'application/pdf', size: 1024 * i, folderId: ((i - 1) % 10) + 1, uploadedAt: iso(i) }),
  },
  {
    name: 'Folders',
    description: 'File folders',
    sample: (i) => ({ id: i, name: `Folder ${i}`, parentId: i > 5 ? i - 5 : null, createdAt: iso(i) }),
  },
  {
    name: 'Genres',
    description: 'Genres for media',
    sample: (i) => ({ id: i, name: pick(['Action', 'Drama', 'Comedy', 'Sci-Fi', 'Horror', 'Romance', 'Thriller'], i) }),
  },
  {
    name: 'Movies',
    description: 'Movies catalog',
    sample: (i) => ({ id: i, title: `Movie ${i}`, year: 1990 + (i % 35), genreId: ((i - 1) % 7) + 1, rating: 1 + (i % 10) * 0.5, runtimeMinutes: 80 + i }),
  },
  {
    name: 'Songs',
    description: 'Songs',
    sample: (i) => ({ id: i, title: `Song ${i}`, artistId: ((i - 1) % 20) + 1, albumId: ((i - 1) % 15) + 1, durationSeconds: 120 + i, genreId: ((i - 1) % 7) + 1 }),
  },
  {
    name: 'Albums',
    description: 'Music albums',
    sample: (i) => ({ id: i, title: `Album ${i}`, artistId: ((i - 1) % 20) + 1, releaseDate: iso(i), trackCount: (i % 15) + 5 }),
  },
  {
    name: 'Artists',
    description: 'Music artists',
    sample: (i) => ({ id: i, name: `Artist ${i}`, country: pick(COUNTRIES, i), genreId: ((i - 1) % 7) + 1 }),
  },
  {
    name: 'Playlists',
    description: 'User playlists',
    sample: (i) => ({ id: i, name: `Playlist ${i}`, userId: ((i - 1) % 50) + 1, songIds: [i, i + 1, i + 2, i + 3], createdAt: iso(i) }),
  },
  {
    name: 'Teams',
    description: 'Sports / project teams',
    sample: (i) => ({ id: i, name: `Team ${i}`, city: pick(CITIES, i), founded: 1900 + (i % 120) }),
  },
  {
    name: 'Players',
    description: 'Sports players',
    sample: (i) => ({ id: i, firstName: pick(FIRST, i), lastName: pick(LAST, i), teamId: ((i - 1) % 10) + 1, position: pick(['GK', 'DF', 'MF', 'FW'], i), number: (i % 99) + 1 }),
  },
  {
    name: 'Matches',
    description: 'Sports matches',
    sample: (i) => ({ id: i, homeTeamId: ((i - 1) % 10) + 1, awayTeamId: (i % 10) + 1, scheduledAt: iso(i), homeScore: i % 5, awayScore: (i + 1) % 5 }),
  },
  {
    name: 'Recipes',
    description: 'Cooking recipes',
    sample: (i) => ({ id: i, name: `Recipe ${i}`, ingredients: [`ingredient-${i}`, `ingredient-${i + 1}`], instructions: lorem(i, 'Steps'), prepMinutes: 5 + i, servings: (i % 6) + 1 }),
  },
  {
    name: 'Restaurants',
    description: 'Restaurants',
    sample: (i) => ({ id: i, name: `Restaurant ${i}`, cuisine: pick(['Italian', 'Japanese', 'Mexican', 'French', 'Filipino', 'Indian'], i), city: pick(CITIES, i), rating: 1 + (i % 5) }),
  },
  {
    name: 'Hotels',
    description: 'Hotels',
    sample: (i) => ({ id: i, name: `Hotel ${i}`, city: pick(CITIES, i), stars: (i % 5) + 1, pricePerNight: 80 + i * 5 }),
  },
  {
    name: 'Bookings',
    description: 'Hotel / service bookings',
    sample: (i) => ({ id: i, hotelId: ((i - 1) % 20) + 1, customerId: ((i - 1) % 50) + 1, checkIn: iso(i), checkOut: iso(i + 3), guests: (i % 5) + 1, total: 250 + i * 25 }),
  },
  {
    name: 'Flights',
    description: 'Flights',
    sample: (i) => ({ id: i, flightNumber: `FL${String(i).padStart(4, '0')}`, origin: pick(CITIES, i), destination: pick(CITIES, i + 1), departure: iso(i), arrival: iso(i + 1), airline: pick(['Delta', 'United', 'PAL', 'JAL', 'Lufthansa'], i) }),
  },
  {
    name: 'Cars',
    description: 'Cars / vehicles',
    sample: (i) => ({ id: i, make: pick(['Toyota', 'Honda', 'Ford', 'BMW', 'Tesla'], i), model: `Model ${i}`, year: 2000 + (i % 25), color: pick(COLORS, i), price: 15000 + i * 500 }),
  },
  {
    name: 'Currencies',
    description: 'Currencies',
    sample: (i) => ({ id: i, code: pick(CURRENCY_CODES, i), name: `${pick(CURRENCY_CODES, i)} Currency`, symbol: pick(['$', '€', '£', '¥', '₱'], i), rateToUsd: 1 + (i % 10) * 0.1 }),
  },
  {
    name: 'Languages',
    description: 'Languages',
    sample: (i) => ({ id: i, code: pick(['en', 'es', 'fr', 'de', 'ja', 'fil', 'zh', 'pt'], i), name: pick(['English', 'Spanish', 'French', 'German', 'Japanese', 'Filipino', 'Chinese', 'Portuguese'], i), nativeName: pick(['English', 'Español', 'Français', 'Deutsch', '日本語', 'Filipino', '中文', 'Português'], i) }),
  },

  // ---- New expanded resources ----
  {
    name: 'Brands',
    description: 'Product brands',
    sample: (i) => ({ id: i, name: `Brand ${i}`, logo: `https://placehold.co/200x50?text=Brand${i}`, country: pick(COUNTRIES, i), founded: 1960 + (i % 60) }),
  },
  {
    name: 'CartItems',
    description: 'Items in shopping carts',
    sample: (i) => ({ id: i, cartId: ((i - 1) % 20) + 1, productId: ((i - 1) % 50) + 1, quantity: (i % 5) + 1, addedAt: iso(i) }),
    count: 20,
  },
  {
    name: 'WishlistItems',
    description: 'Items in wishlists',
    sample: (i) => ({ id: i, wishlistId: ((i - 1) % 15) + 1, productId: ((i - 1) % 50) + 1, addedAt: iso(i) }),
    count: 20,
  },
  {
    name: 'Likes',
    description: 'User likes on posts and products',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, postId: ((i - 1) % 50) + 1, type: pick(['post', 'product', 'comment'], i), createdAt: iso(i) }),
    count: 30,
  },
  {
    name: 'Follows',
    description: 'User follows / subscriptions',
    sample: (i) => ({ id: i, followerId: ((i - 1) % 50) + 1, followingId: (i % 50) + 1, createdAt: iso(i) }),
    count: 25,
  },
  {
    name: 'Messages',
    description: 'Direct messages between users',
    sample: (i) => ({ id: i, conversationId: ((i - 1) % 15) + 1, senderId: ((i - 1) % 50) + 1, body: lorem(i, 'Message'), createdAt: iso(i), read: i % 2 === 0 }),
    count: 25,
  },
  {
    name: 'Conversations',
    description: 'Message conversation threads',
    sample: (i) => ({ id: i, userId1: ((i - 1) % 50) + 1, userId2: (i % 50) + 1, lastMessageAt: iso(i), messageCount: 5 + (i % 20) }),
    count: 15,
  },
  {
    name: 'ProductVariants',
    description: 'Product color/size/sku variants',
    sample: (i) => ({ id: i, productId: ((i - 1) % 50) + 1, sku: `VAR-${1000 + i}`, color: pick(COLORS, i), size: pick(SIZES, i), stock: 10 + (i % 50) }),
    count: 25,
  },
  {
    name: 'Returns',
    description: 'Returned orders and items',
    sample: (i) => ({ id: i, orderId: ((i - 1) % 30) + 1, reason: pick(['defective', 'wrong_item', 'not_as_described', 'changed_mind'], i), status: pick(STATUSES, i), requestedAt: iso(i), resolvedAt: iso(i + 7) }),
    count: 15,
  },
  {
    name: 'ReviewReplies',
    description: 'Seller replies to product reviews',
    sample: (i) => ({ id: i, reviewId: ((i - 1) % 30) + 1, body: lorem(i, 'Reply'), authorId: ((i - 1) % 20) + 1, createdAt: iso(i) }),
    count: 20,
  },
  {
    name: 'ArticleTags',
    description: 'Tag assignments for articles',
    sample: (i) => ({ id: i, articleId: ((i - 1) % 40) + 1, tagId: ((i - 1) % 20) + 1, assignedAt: iso(i) }),
    count: 20,
  },
  {
    name: 'PageViews',
    description: 'User page view tracking',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, pageUrl: `/products/${(i % 50) + 1}`, referrer: i % 3 === 0 ? 'search' : 'direct', viewedAt: iso(i) }),
    count: 30,
  },
  {
    name: 'UserActivity',
    description: 'User activity logs',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, action: pick(['login', 'logout', 'view', 'purchase', 'review'], i), details: `Activity ${i}`, timestamp: iso(i) }),
    count: 25,
  },
  {
    name: 'Ratings',
    description: 'Generic ratings (not product-specific)',
    sample: (i) => ({ id: i, targetId: i, targetType: pick(['article', 'restaurant', 'hotel'], i), score: (i % 5) + 1, userId: ((i - 1) % 50) + 1, createdAt: iso(i) }),
    count: 20,
  },
  {
    name: 'Banners',
    description: 'Promotional banners',
    sample: (i) => ({ id: i, title: `Banner ${i}`, imageUrl: `https://placehold.co/1200x300?text=Banner${i}`, link: `/promo/${i}`, active: i % 2 === 0, startDate: iso(i), endDate: iso(i + 30) }),
    count: 10,
  },
  {
    name: 'Promotions',
    description: 'Promotional campaigns',
    sample: (i) => ({ id: i, name: `Promotion ${i}`, description: lorem(i, 'Promo'), discount: 5 + (i % 40), startDate: iso(i), endDate: iso(i + 15), active: i % 2 === 0 }),
    count: 15,
  },
  {
    name: 'Discounts',
    description: 'Discount rules and offers',
    sample: (i) => ({ id: i, code: `DISC${String(i).padStart(3, '0')}`, percentage: 5 + (i % 30), minAmount: 50 + i * 10, maxUses: 100 + i, used: i % 10, active: i % 2 === 0 }),
    count: 12,
  },
  {
    name: 'Favorites',
    description: 'User favorite products and items',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, productId: ((i - 1) % 50) + 1, addedAt: iso(i) }),
    count: 20,
  },
  {
    name: 'SearchQueries',
    description: 'Recorded user search queries',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, query: `search query ${i}`, resultsCount: 5 + (i % 100), searchedAt: iso(i) }),
    count: 25,
  },
  {
    name: 'Badges',
    description: 'User achievement badges',
    sample: (i) => ({ id: i, name: `Badge ${i}`, description: lorem(i, 'Badge'), icon: `https://placehold.co/64x64?text=Badge${i}`, criteria: `Achievement ${i}` }),
    count: 18,
  },
  {
    name: 'UserBadges',
    description: 'Badges earned by users',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, badgeId: ((i - 1) % 18) + 1, earnedAt: iso(i) }),
    count: 30,
  },
  {
    name: 'Reports',
    description: 'Generated reports and analytics',
    sample: (i) => ({ id: i, type: pick(['sales', 'traffic', 'inventory', 'customer'], i), period: pick(['daily', 'weekly', 'monthly'], i), generatedAt: iso(i), data: `Report data for ${i}` }),
    count: 20,
  },
  {
    name: 'Refunds',
    description: 'Refund transactions',
    sample: (i) => ({ id: i, orderId: ((i - 1) % 30) + 1, amount: 50 + (i % 200), reason: pick(['return', 'cancel', 'error'], i), status: pick(STATUSES, i), initiatedAt: iso(i), completedAt: iso(i + 3) }),
    count: 12,
  },
  {
    name: 'Vendors',
    description: 'Third-party vendors and sellers',
    sample: (i) => ({ id: i, name: `Vendor ${i}`, email: `vendor${i}@example.com`, status: pick(['active', 'pending', 'inactive'], i), rating: 2 + (i % 4), joinedAt: iso(i) }),
    count: 16,
  },
  {
    name: 'Transactions',
    description: 'Financial transactions',
    sample: (i) => ({ id: i, vendorId: ((i - 1) % 16) + 1, orderId: ((i - 1) % 30) + 1, amount: 100 + (i % 500), commission: 5 + (i % 20), status: pick(STATUSES, i), createdAt: iso(i) }),
    count: 28,
  },
  {
    name: 'CouponUsages',
    description: 'Coupon usage records',
    sample: (i) => ({ id: i, couponId: ((i - 1) % 30) + 1, orderId: ((i - 1) % 30) + 1, discount: 5 + (i % 50), appliedAt: iso(i) }),
    count: 24,
  },
  {
    name: 'Preferences',
    description: 'User preferences and settings',
    sample: (i) => ({ id: i, userId: ((i - 1) % 50) + 1, language: pick(['en', 'es', 'fr', 'de'], i), currency: pick(CURRENCY_CODES, i), timezone: `UTC${-12 + (i % 24)}`, notifications: i % 2 === 0, newsletter: i % 3 === 0 }),
    count: 20,
  },
  {
    name: 'PaymentMethods',
    description: 'Saved customer payment methods',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, type: pick(['card', 'wallet', 'bank'], i), brand: pick(['Visa', 'Mastercard', 'Amex', 'PayPal', 'ACH'], i), last4: String(1000 + (i % 9000)), expiresAt: iso(i + 30), isDefault: i % 4 === 0 }),
    count: 30,
  },
  {
    name: 'CustomerAddresses',
    description: 'Address book entries for customers',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, addressId: ((i - 1) % 10) + 1, label: pick(['home', 'work', 'billing', 'shipping'], i), isDefault: i % 5 === 0 }),
    count: 30,
  },
  {
    name: 'OrderNotes',
    description: 'Internal and customer-facing notes on orders',
    sample: (i) => ({ id: i, orderId: ((i - 1) % 30) + 1, authorId: ((i - 1) % 10) + 1, body: lorem(i, 'Order note'), createdAt: iso(i) }),
    count: 24,
  },
  {
    name: 'ShipmentEvents',
    description: 'Tracking milestones within a shipment lifecycle',
    sample: (i) => ({ id: i, shipmentId: ((i - 1) % 30) + 1, status: pick(['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'], i), location: pick(CITIES, i), occurredAt: iso(i), details: lorem(i, 'Shipment event') }),
    count: 30,
  },
  {
    name: 'InvoiceItems',
    description: 'Line items attached to invoices',
    sample: (i) => ({ id: i, invoiceId: ((i - 1) % 30) + 1, productId: ((i - 1) % 50) + 1, description: `Invoice item ${i}`, quantity: (i % 4) + 1, unitPrice: 25 + i, total: ((i % 4) + 1) * (25 + i) }),
    count: 30,
  },
  {
    name: 'LoyaltyAccounts',
    description: 'Customer loyalty and rewards accounts',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, tier: pick(['bronze', 'silver', 'gold', 'platinum'], i), points: 100 + i * 25, lifetimePoints: 500 + i * 75, joinedAt: iso(i) }),
    count: 20,
  },
  {
    name: 'LoyaltyTransactions',
    description: 'Point earnings and redemptions for loyalty accounts',
    sample: (i) => ({ id: i, accountId: ((i - 1) % 20) + 1, orderId: ((i - 1) % 30) + 1, type: pick(['earn', 'redeem', 'adjustment'], i), points: 10 + (i % 90), createdAt: iso(i) }),
    count: 30,
  },
  {
    name: 'EventAttendees',
    description: 'People attending scheduled events',
    sample: (i) => ({ id: i, eventId: ((i - 1) % 10) + 1, userId: ((i - 1) % 10) + 1, ticketId: ((i - 1) % 10) + 1, status: pick(['registered', 'checked_in', 'cancelled'], i), checkedInAt: i % 3 === 0 ? iso(i) : null }),
    count: 24,
  },
  {
    name: 'PlaylistItems',
    description: 'Ordered songs within playlists',
    sample: (i) => ({ id: i, playlistId: ((i - 1) % 10) + 1, songId: ((i - 1) % 10) + 1, position: (i % 20) + 1, addedAt: iso(i) }),
    count: 36,
  },
  {
    name: 'RecipeIngredients',
    description: 'Ingredient entries tied to recipes',
    sample: (i) => ({ id: i, recipeId: ((i - 1) % 10) + 1, name: `Ingredient ${i}`, quantity: (i % 5) + 1, unit: pick(['g', 'kg', 'ml', 'cup', 'tbsp'], i) }),
    count: 30,
  },
  {
    name: 'RestaurantMenus',
    description: 'Menus published by restaurants',
    sample: (i) => ({ id: i, restaurantId: ((i - 1) % 10) + 1, name: pick(['Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Seasonal'], i), active: i % 2 === 0, updatedAt: iso(i) }),
    count: 24,
  },
  {
    name: 'MenuItems',
    description: 'Individual dishes and drinks on menus',
    sample: (i) => ({ id: i, menuId: ((i - 1) % 24) + 1, name: `Menu Item ${i}`, category: pick(['starter', 'main', 'dessert', 'drink'], i), price: 8 + i, available: i % 5 !== 0 }),
    count: 40,
  },
  {
    name: 'CompanyOffices',
    description: 'Office locations operated by companies',
    sample: (i) => ({ id: i, companyId: ((i - 1) % 10) + 1, addressId: ((i - 1) % 10) + 1, name: `Office ${i}`, phone: `+1-555-03${String(i).padStart(2, '0')}` }),
    count: 24,
  },
  {
    name: 'EmployeeSkills',
    description: 'Skills and proficiencies for employees',
    sample: (i) => ({ id: i, employeeId: ((i - 1) % 10) + 1, name: pick(['TypeScript', 'Project Management', 'Design', 'Negotiation', 'Data Analysis'], i), level: pick(['beginner', 'intermediate', 'advanced', 'expert'], i), certified: i % 3 === 0 }),
    count: 30,
  },
  {
    name: 'SupplierProducts',
    description: 'Supplier-specific product procurement offers',
    sample: (i) => ({ id: i, supplierId: ((i - 1) % 10) + 1, productId: ((i - 1) % 50) + 1, cost: 5 + i, currency: pick(CURRENCY_CODES, i), leadTimeDays: (i % 14) + 1 }),
    count: 36,
  },
  {
    name: 'FlightBookings',
    description: 'Customer reservations on flights',
    sample: (i) => ({ id: i, flightId: ((i - 1) % 10) + 1, customerId: ((i - 1) % 50) + 1, seat: `${pick(['A', 'B', 'C', 'D', 'E', 'F'], i)}${(i % 30) + 1}`, status: pick(['confirmed', 'checked_in', 'cancelled'], i), price: 120 + i * 8 }),
    count: 24,
  },
  {
    name: 'PromotionProducts',
    description: 'Products featured in active promotions',
    sample: (i) => ({ id: i, promotionId: ((i - 1) % 15) + 1, productId: ((i - 1) % 50) + 1, featured: i % 2 === 0, sortOrder: (i % 12) + 1 }),
    count: 30,
  },
  {
    name: 'BannerPlacements',
    description: 'Banner placements across pages and slots',
    sample: (i) => ({ id: i, bannerId: ((i - 1) % 10) + 1, page: pick(['home', 'category', 'product', 'checkout', 'blog'], i), slot: pick(['hero', 'sidebar', 'footer', 'inline'], i), startsAt: iso(i), endsAt: iso(i + 7) }),
    count: 20,
  },
  {
    name: 'SupportTickets',
    description: 'Customer support cases linked to orders',
    sample: (i) => ({ id: i, customerId: ((i - 1) % 50) + 1, orderId: ((i - 1) % 30) + 1, subject: `Support Ticket ${i}`, status: pick(['open', 'pending', 'resolved', 'closed'], i), priority: pick(PRIORITIES, i), createdAt: iso(i) }),
    count: 20,
  },
  {
    name: 'TicketReplies',
    description: 'Replies on support tickets',
    sample: (i) => ({ id: i, ticketId: ((i - 1) % 20) + 1, authorType: pick(['customer', 'agent'], i), authorId: ((i - 1) % 10) + 1, body: lorem(i, 'Ticket reply'), createdAt: iso(i) }),
    count: 30,
  },
];
