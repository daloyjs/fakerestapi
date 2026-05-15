import { RESOURCES, seededCountFor, type ResourceDef, type Sample } from './resources.js';

const resourceMap = new Map<string, ResourceDef>(RESOURCES.map((resource) => [resource.name, resource]));

function countFor(name: string): number {
  return seededCountFor(resourceMap.get(name));
}

function normalizeId(name: string, id: number): number {
  const count = countFor(name);
  return ((Math.max(1, id) - 1) % count) + 1;
}

function sampleOf(name: string, id: number): Sample {
  const resource = resourceMap.get(name);
  if (!resource) return { id };
  return resource.sample(normalizeId(name, id));
}

function listOf(name: string): Sample[] {
  const resource = resourceMap.get(name);
  const count = countFor(name);
  if (!resource) return [];

  const items: Sample[] = [];
  for (let index = 1; index <= count; index++) items.push(resource.sample(index));
  return items;
}

function selectFields(sample: Sample, fields: string[]): Sample {
  const out: Sample = {};
  for (const field of fields) {
    out[field] = sample[field];
  }
  return out;
}

function summaryOf(name: string, id: number, fields: string[]): Sample {
  return selectFields(sampleOf(name, id), fields);
}

function numberField(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function enrichSample(resourceName: string, item: Sample): Sample {
  switch (resourceName) {
    case 'Books': {
      const bookId = numberField(item.id);
      const authors = listOf('Authors')
        .filter((author) => author.idBook === bookId)
        .map((author) => selectFields(author, ['id', 'firstName', 'lastName']));
      const coverPhotos = listOf('CoverPhotos')
        .filter((photo) => photo.idBook === bookId)
        .map((photo) => selectFields(photo, ['id', 'url']));
      return { ...item, authors, coverPhotos };
    }

    case 'Products': {
      const productId = numberField(item.id);
      const categoryId = numberField(item.categoryId);
      const reviews = listOf('Reviews')
        .filter((review) => review.productId === productId)
        .map((review) => ({
          ...selectFields(review, ['id', 'customerId', 'rating', 'title', 'body', 'createdAt']),
          customer: summaryOf('Customers', numberField(review.customerId), ['id', 'firstName', 'lastName', 'email']),
        }));
      const inventories = listOf('Inventories')
        .filter((inventory) => inventory.productId === productId)
        .map((inventory) => ({
          ...selectFields(inventory, ['id', 'warehouseId', 'quantity', 'lastChecked']),
          warehouse: summaryOf('Warehouses', numberField(inventory.warehouseId), ['id', 'name', 'location']),
        }));
      return {
        ...item,
        category: summaryOf('Categories', categoryId, ['id', 'name', 'slug']),
        reviews,
        inventory: inventories,
      };
    }

    case 'Orders': {
      const orderId = numberField(item.id);
      const orderItems = listOf('OrderItems')
        .filter((orderItem) => orderItem.orderId === orderId)
        .map((orderItem) => ({
          ...selectFields(orderItem, ['id', 'productId', 'quantity', 'unitPrice', 'discount']),
          product: summaryOf('Products', numberField(orderItem.productId), ['id', 'sku', 'name', 'price']),
        }));
      const invoice = listOf('Invoices').find((candidate) => candidate.orderId === orderId);
      const shipment = listOf('Shipments').find((candidate) => candidate.orderId === orderId);
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email', 'phone']),
        shippingAddress: summaryOf('Addresses', numberField(item.shippingAddressId), ['id', 'line1', 'city', 'state', 'country']),
        items: orderItems,
        invoice: invoice ? selectFields(invoice, ['id', 'number', 'issueDate', 'dueDate', 'amount', 'currency', 'paid']) : null,
        shipment: shipment ? selectFields(shipment, ['id', 'trackingNumber', 'carrier', 'status', 'shippedAt', 'deliveredAt']) : null,
      };
    }

    case 'Invoices': {
      const invoiceId = numberField(item.id);
      const payments = listOf('Payments')
        .filter((payment) => payment.invoiceId === invoiceId)
        .map((payment) => selectFields(payment, ['id', 'amount', 'currency', 'method', 'paidAt']));
      const items = listOf('InvoiceItems')
        .filter((invoiceItem) => invoiceItem.invoiceId === invoiceId)
        .map((invoiceItem) => ({
          ...selectFields(invoiceItem, ['id', 'productId', 'description', 'quantity', 'unitPrice', 'total']),
          product: summaryOf('Products', numberField(invoiceItem.productId), ['id', 'sku', 'name', 'price']),
        }));
      return {
        ...item,
        payments,
        items,
      };
    }

    case 'Customers': {
      const customerId = numberField(item.id);
      const orders = listOf('Orders')
        .filter((order) => order.customerId === customerId)
        .map((order) => selectFields(order, ['id', 'orderDate', 'status', 'total', 'currency']));
      const carts = listOf('Carts')
        .filter((cart) => cart.customerId === customerId)
        .map((cart) => selectFields(cart, ['id', 'createdAt', 'updatedAt', 'itemCount']));
      const wishlists = listOf('Wishlists')
        .filter((wishlist) => wishlist.customerId === customerId)
        .map((wishlist) => selectFields(wishlist, ['id', 'name', 'productIds']));
      const paymentMethods = listOf('PaymentMethods')
        .filter((paymentMethod) => paymentMethod.customerId === customerId)
        .map((paymentMethod) => selectFields(paymentMethod, ['id', 'type', 'brand', 'last4', 'expiresAt', 'isDefault']));
      const addresses = listOf('CustomerAddresses')
        .filter((customerAddress) => customerAddress.customerId === customerId)
        .map((customerAddress) => ({
          ...selectFields(customerAddress, ['id', 'addressId', 'label', 'isDefault']),
          address: summaryOf('Addresses', numberField(customerAddress.addressId), ['id', 'line1', 'city', 'state', 'country']),
        }));
      const loyaltyAccounts = listOf('LoyaltyAccounts')
        .filter((loyaltyAccount) => loyaltyAccount.customerId === customerId)
        .map((loyaltyAccount) => selectFields(loyaltyAccount, ['id', 'tier', 'points', 'lifetimePoints', 'joinedAt']));
      return { ...item, orders, carts, wishlists, paymentMethods, addresses, loyaltyAccounts };
    }

    case 'Employees': {
      const employeeId = numberField(item.id);
      const managerId = numberField(item.managerId, 0);
      const projects = listOf('Projects')
        .filter((project) => project.ownerId === employeeId)
        .map((project) => selectFields(project, ['id', 'name', 'status', 'startDate', 'endDate']));
      return {
        ...item,
        department: summaryOf('Departments', numberField(item.departmentId), ['id', 'name', 'code', 'budget']),
        manager: managerId > 0 ? summaryOf('Employees', managerId, ['id', 'firstName', 'lastName', 'email']) : null,
        projects,
      };
    }

    case 'Departments': {
      const departmentId = numberField(item.id);
      const employees = listOf('Employees')
        .filter((employee) => employee.departmentId === departmentId)
        .map((employee) => selectFields(employee, ['id', 'firstName', 'lastName', 'email', 'salary', 'hiredAt']));
      return {
        ...item,
        headEmployee: summaryOf('Employees', numberField(item.headEmployeeId), ['id', 'firstName', 'lastName', 'email']),
        employees,
      };
    }

    case 'Projects': {
      const projectId = numberField(item.id);
      const tasks = listOf('Tasks')
        .filter((task) => task.projectId === projectId)
        .map((task) => ({
          ...selectFields(task, ['id', 'title', 'priority', 'status', 'dueDate']),
          assignee: summaryOf('Employees', numberField(task.assigneeId), ['id', 'firstName', 'lastName', 'email']),
        }));
      return {
        ...item,
        owner: summaryOf('Employees', numberField(item.ownerId), ['id', 'firstName', 'lastName', 'email']),
        tasks,
      };
    }

    case 'Tasks': {
      return {
        ...item,
        project: summaryOf('Projects', numberField(item.projectId), ['id', 'name', 'status', 'startDate', 'endDate']),
        assignee: summaryOf('Employees', numberField(item.assigneeId), ['id', 'firstName', 'lastName', 'email']),
      };
    }

    case 'Posts': {
      const postId = numberField(item.id);
      const comments = listOf('Comments')
        .filter((comment) => comment.postId === postId)
        .map((comment) => ({
          ...selectFields(comment, ['id', 'authorId', 'body', 'createdAt']),
          author: summaryOf('Users', numberField(comment.authorId), ['id', 'userName']),
        }));
      return {
        ...item,
        author: summaryOf('Users', numberField(item.authorId), ['id', 'userName']),
        comments,
      };
    }

    case 'Companies': {
      const companyId = numberField(item.id);
      const offices = listOf('CompanyOffices')
        .filter((office) => office.companyId === companyId)
        .map((office) => ({
          ...selectFields(office, ['id', 'addressId', 'name', 'phone']),
          address: summaryOf('Addresses', numberField(office.addressId), ['id', 'line1', 'city', 'state', 'country']),
        }));
      return {
        ...item,
        offices,
      };
    }

    case 'Subscriptions': {
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        plan: summaryOf('Plans', numberField(item.planId), ['id', 'name', 'price', 'interval']),
      };
    }

    case 'Carts': {
      const cartId = numberField(item.id);
      const items = listOf('CartItems')
        .filter((cartItem) => cartItem.cartId === cartId)
        .map((cartItem) => ({
          ...selectFields(cartItem, ['id', 'productId', 'quantity', 'addedAt']),
          product: summaryOf('Products', numberField(cartItem.productId), ['id', 'sku', 'name', 'price']),
        }));
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        items,
      };
    }

    case 'CartItems': {
      return {
        ...item,
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price', 'color', 'size']),
      };
    }

    case 'WishlistItems': {
      return {
        ...item,
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price', 'categoryId']),
      };
    }

    case 'Wishlists': {
      const wishlistId = numberField(item.id);
      const items = listOf('WishlistItems')
        .filter((wishlistItem) => wishlistItem.wishlistId === wishlistId)
        .map((wishlistItem) => ({
          ...selectFields(wishlistItem, ['id', 'productId', 'addedAt']),
          product: summaryOf('Products', numberField(wishlistItem.productId), ['id', 'sku', 'name', 'price']),
        }));
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        items,
      };
    }

    case 'Likes': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
      };
    }

    case 'Follows': {
      return {
        ...item,
        follower: summaryOf('Users', numberField(item.followerId), ['id', 'userName']),
        following: summaryOf('Users', numberField(item.followingId), ['id', 'userName']),
      };
    }

    case 'Messages': {
      return {
        ...item,
        sender: summaryOf('Users', numberField(item.senderId), ['id', 'userName']),
        conversation: summaryOf('Conversations', numberField(item.conversationId), ['id', 'lastMessageAt']),
      };
    }

    case 'Conversations': {
      const conversationId = numberField(item.id);
      const messages = listOf('Messages')
        .filter((msg) => msg.conversationId === conversationId)
        .slice(0, 5)
        .map((msg) => selectFields(msg, ['id', 'senderId', 'body', 'createdAt', 'read']));
      return {
        ...item,
        user1: summaryOf('Users', numberField(item.userId1), ['id', 'userName']),
        user2: summaryOf('Users', numberField(item.userId2), ['id', 'userName']),
        messages,
      };
    }

    case 'ProductVariants': {
      return {
        ...item,
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price']),
      };
    }

    case 'Returns': {
      return {
        ...item,
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
      };
    }

    case 'ReviewReplies': {
      return {
        ...item,
        review: summaryOf('Reviews', numberField(item.reviewId), ['id', 'productId', 'rating', 'title']),
        author: summaryOf('Users', numberField(item.authorId), ['id', 'userName']),
      };
    }

    case 'Reviews': {
      const reviewId = numberField(item.id);
      const replies = listOf('ReviewReplies')
        .filter((reply) => reply.reviewId === reviewId)
        .map((reply) => ({
          ...selectFields(reply, ['id', 'body', 'createdAt']),
          author: summaryOf('Users', numberField(reply.authorId), ['id', 'userName']),
        }));
      return {
        ...item,
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name']),
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        replies,
      };
    }

    case 'ArticleTags': {
      return {
        ...item,
        article: summaryOf('Articles', numberField(item.articleId), ['id', 'title', 'slug']),
        tag: summaryOf('Tags', numberField(item.tagId), ['id', 'name', 'color']),
      };
    }

    case 'Articles': {
      const articleId = numberField(item.id);
      const tags = listOf('ArticleTags')
        .filter((at) => at.articleId === articleId)
        .map((at) => ({
          ...selectFields(at, ['id', 'tagId']),
          tag: summaryOf('Tags', numberField(at.tagId), ['id', 'name', 'color']),
        }));
      return {
        ...item,
        author: summaryOf('Users', numberField(item.authorId), ['id', 'userName']),
        tags,
      };
    }

    case 'UserBadges': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
        badge: summaryOf('Badges', numberField(item.badgeId), ['id', 'name', 'icon']),
      };
    }

    case 'Users': {
      const userId = numberField(item.id);
      const badges = listOf('UserBadges')
        .filter((ub) => ub.userId === userId)
        .map((ub) => selectFields(ub, ['id', 'badgeId', 'earnedAt']));
      const preferences = listOf('Preferences').find((p) => p.userId === userId);
      return {
        ...item,
        badges,
        preferences: preferences ? selectFields(preferences, ['language', 'currency', 'timezone', 'notifications', 'newsletter']) : null,
      };
    }

    case 'Events': {
      const eventId = numberField(item.id);
      const attendees = listOf('EventAttendees')
        .filter((attendee) => attendee.eventId === eventId)
        .map((attendee) => ({
          ...selectFields(attendee, ['id', 'userId', 'ticketId', 'status', 'checkedInAt']),
          user: summaryOf('Users', numberField(attendee.userId), ['id', 'userName']),
        }));
      return {
        ...item,
        venue: summaryOf('Venues', eventId, ['id', 'name', 'address', 'city', 'capacity']),
        attendees,
      };
    }

    case 'Bookings': {
      return {
        ...item,
        hotel: summaryOf('Hotels', numberField(item.hotelId), ['id', 'name', 'city', 'stars', 'pricePerNight']),
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email', 'phone']),
      };
    }

    case 'Hotels': {
      const hotelId = numberField(item.id);
      const bookings = listOf('Bookings')
        .filter((booking) => booking.hotelId === hotelId)
        .slice(0, 5)
        .map((booking) => selectFields(booking, ['id', 'customerId', 'checkIn', 'checkOut', 'guests', 'total']));
      return {
        ...item,
        bookings,
      };
    }

    case 'Flights': {
      const flightId = numberField(item.id);
      const bookings = listOf('FlightBookings')
        .filter((booking) => booking.flightId === flightId)
        .map((booking) => ({
          ...selectFields(booking, ['id', 'customerId', 'seat', 'status', 'price']),
          customer: summaryOf('Customers', numberField(booking.customerId), ['id', 'firstName', 'lastName', 'email']),
        }));
      return {
        ...item,
        bookings,
      };
    }

    case 'Playlists': {
      const playlistId = numberField(item.id);
      const items = listOf('PlaylistItems')
        .filter((playlistItem) => playlistItem.playlistId === playlistId)
        .map((playlistItem) => ({
          ...selectFields(playlistItem, ['id', 'songId', 'position', 'addedAt']),
          song: summaryOf('Songs', numberField(playlistItem.songId), ['id', 'title', 'artistId', 'durationSeconds']),
        }));
      return {
        ...item,
        items,
      };
    }

    case 'Recipes': {
      const recipeId = numberField(item.id);
      const ingredients = listOf('RecipeIngredients')
        .filter((ingredient) => ingredient.recipeId === recipeId)
        .map((ingredient) => selectFields(ingredient, ['id', 'name', 'quantity', 'unit']));
      return {
        ...item,
        ingredients,
      };
    }

    case 'Restaurants': {
      const restaurantId = numberField(item.id);
      const menus = listOf('RestaurantMenus')
        .filter((menu) => menu.restaurantId === restaurantId)
        .map((menu) => selectFields(menu, ['id', 'name', 'active', 'updatedAt']));
      return {
        ...item,
        menus,
      };
    }

    case 'Vendors': {
      const vendorId = numberField(item.id);
      const transactions = listOf('Transactions')
        .filter((t) => t.vendorId === vendorId)
        .slice(0, 5)
        .map((t) => selectFields(t, ['id', 'orderId', 'amount', 'commission', 'status', 'createdAt']));
      return {
        ...item,
        transactions,
      };
    }

    case 'Transactions': {
      return {
        ...item,
        vendor: summaryOf('Vendors', numberField(item.vendorId), ['id', 'name', 'email', 'rating']),
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
      };
    }

    case 'Refunds': {
      return {
        ...item,
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
      };
    }

    case 'CouponUsages': {
      return {
        ...item,
        coupon: summaryOf('Coupons', numberField(item.couponId), ['id', 'code', 'percentage']),
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
      };
    }

    case 'Preferences': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
      };
    }

    case 'UserActivity': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
      };
    }

    case 'PageViews': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
      };
    }

    case 'Favorites': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price']),
      };
    }

    case 'SearchQueries': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
      };
    }

    case 'Ratings': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
      };
    }

    case 'PaymentMethods': {
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
      };
    }

    case 'CustomerAddresses': {
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        address: summaryOf('Addresses', numberField(item.addressId), ['id', 'line1', 'city', 'state', 'country']),
      };
    }

    case 'OrderNotes': {
      return {
        ...item,
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
        author: summaryOf('Users', numberField(item.authorId), ['id', 'userName']),
      };
    }

    case 'ShipmentEvents': {
      return {
        ...item,
        shipment: summaryOf('Shipments', numberField(item.shipmentId), ['id', 'trackingNumber', 'carrier', 'status']),
      };
    }

    case 'InvoiceItems': {
      return {
        ...item,
        invoice: summaryOf('Invoices', numberField(item.invoiceId), ['id', 'number', 'amount', 'currency', 'paid']),
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price']),
      };
    }

    case 'LoyaltyAccounts': {
      const accountId = numberField(item.id);
      const transactions = listOf('LoyaltyTransactions')
        .filter((transaction) => transaction.accountId === accountId)
        .map((transaction) => selectFields(transaction, ['id', 'orderId', 'type', 'points', 'createdAt']));
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        transactions,
      };
    }

    case 'LoyaltyTransactions': {
      return {
        ...item,
        account: summaryOf('LoyaltyAccounts', numberField(item.accountId), ['id', 'tier', 'points', 'lifetimePoints']),
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
      };
    }

    case 'EventAttendees': {
      return {
        ...item,
        user: summaryOf('Users', numberField(item.userId), ['id', 'userName']),
        ticket: summaryOf('Tickets', numberField(item.ticketId), ['id', 'holderName', 'seat', 'price', 'status']),
      };
    }

    case 'PlaylistItems': {
      return {
        ...item,
        song: summaryOf('Songs', numberField(item.songId), ['id', 'title', 'artistId', 'durationSeconds']),
      };
    }

    case 'CompanyOffices': {
      return {
        ...item,
        company: summaryOf('Companies', numberField(item.companyId), ['id', 'name', 'industry', 'website']),
        address: summaryOf('Addresses', numberField(item.addressId), ['id', 'line1', 'city', 'state', 'country']),
      };
    }

    case 'EmployeeSkills': {
      return {
        ...item,
        employee: summaryOf('Employees', numberField(item.employeeId), ['id', 'firstName', 'lastName', 'email']),
      };
    }

    case 'SupplierProducts': {
      return {
        ...item,
        supplier: summaryOf('Suppliers', numberField(item.supplierId), ['id', 'name', 'contactEmail', 'country']),
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price']),
      };
    }

    case 'FlightBookings': {
      return {
        ...item,
        flight: summaryOf('Flights', numberField(item.flightId), ['id', 'flightNumber', 'origin', 'destination', 'departure', 'arrival']),
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
      };
    }

    case 'RestaurantMenus': {
      const menuId = numberField(item.id);
      const items = listOf('MenuItems')
        .filter((menuItem) => menuItem.menuId === menuId)
        .map((menuItem) => selectFields(menuItem, ['id', 'name', 'category', 'price', 'available']));
      return {
        ...item,
        items,
      };
    }

    case 'MenuItems': {
      return {
        ...item,
        menu: summaryOf('RestaurantMenus', numberField(item.menuId), ['id', 'restaurantId', 'name', 'active']),
      };
    }

    case 'Promotions': {
      const promotionId = numberField(item.id);
      const products = listOf('PromotionProducts')
        .filter((promotionProduct) => promotionProduct.promotionId === promotionId)
        .map((promotionProduct) => ({
          ...selectFields(promotionProduct, ['id', 'productId', 'featured', 'sortOrder']),
          product: summaryOf('Products', numberField(promotionProduct.productId), ['id', 'sku', 'name', 'price']),
        }));
      return {
        ...item,
        products,
      };
    }

    case 'PromotionProducts': {
      return {
        ...item,
        product: summaryOf('Products', numberField(item.productId), ['id', 'sku', 'name', 'price']),
      };
    }

    case 'Banners': {
      const bannerId = numberField(item.id);
      const placements = listOf('BannerPlacements')
        .filter((placement) => placement.bannerId === bannerId)
        .map((placement) => selectFields(placement, ['id', 'page', 'slot', 'startsAt', 'endsAt']));
      return {
        ...item,
        placements,
      };
    }

    case 'SupportTickets': {
      const ticketId = numberField(item.id);
      const replies = listOf('TicketReplies')
        .filter((reply) => reply.ticketId === ticketId)
        .map((reply) => selectFields(reply, ['id', 'authorType', 'authorId', 'body', 'createdAt']));
      return {
        ...item,
        customer: summaryOf('Customers', numberField(item.customerId), ['id', 'firstName', 'lastName', 'email']),
        order: summaryOf('Orders', numberField(item.orderId), ['id', 'orderDate', 'status', 'total']),
        replies,
      };
    }

    case 'TicketReplies': {
      return {
        ...item,
        ticket: summaryOf('SupportTickets', numberField(item.ticketId), ['id', 'subject', 'status', 'priority']),
      };
    }

    default:
      return item;
  }
}