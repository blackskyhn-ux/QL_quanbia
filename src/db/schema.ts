import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// -------------------------------------------------------------
// 1. Roles & Users (Phân quyền & Tài khoản)
// -------------------------------------------------------------
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 'admin', 'manager', 'cashier', 'staff'
  description: text('description'),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  roleId: integer('role_id').references(() => roles.id),
  phone: text('phone'),
  status: text('status').notNull().default('active'), // 'active', 'inactive'
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// 2. Areas & Tables (Khu vực & Sơ đồ Bàn)
// -------------------------------------------------------------
export const areas = sqliteTable('areas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // 'Tầng 1 (Sảnh chính)', 'Sân vườn', 'VIP Layer'
  sortOrder: integer('sort_order').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const tables = sqliteTable('tables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  areaId: integer('area_id').notNull().references(() => areas.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // 'Bàn 01', 'Bàn 02', 'Bàn VIP 1'
  seats: integer('seats').default(4),
  status: text('status').notNull().default('available'), // 'available', 'occupied', 'reserved', 'maintenance'
  currentOrderId: integer('current_order_id'),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// 3. Categories & Products (Danh mục & Bia / Món nhậu)
// -------------------------------------------------------------
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // 'Bia Hơi & Bia Chai', 'Món Nhậu Đặc Sản', 'Lẩu & Nướng', 'Khai Vị & Ăn Vặt', 'Nước Giải Khát'
  icon: text('icon').default('Beer'),
  sortOrder: integer('sort_order').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').unique(),
  price: real('price').notNull().default(0), // Giá bán
  costPrice: real('cost_price').default(0), // Giá vốn nhập
  unit: text('unit').notNull().default('Đĩa'), // 'Cốc', 'Chai', 'Thùng', 'Đĩa', 'Nồi', 'Lon'
  stockQuantity: integer('stock_quantity').default(100),
  minStockLevel: integer('min_stock_level').default(10),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
  imageUrl: text('image_url'),
  description: text('description'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// 4. Orders & Order Items (Đơn hàng & Chi tiết gọi món)
// -------------------------------------------------------------
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().unique(), // 'HD-20260917-001'
  tableId: integer('table_id').references(() => tables.id),
  userId: integer('user_id').references(() => users.id), // Thu ngân/Phục vụ tạo
  status: text('status').notNull().default('serving'), // 'serving', 'completed', 'cancelled'
  totalAmount: real('total_amount').notNull().default(0),
  discountAmount: real('discount_amount').default(0),
  discountPercent: real('discount_percent').default(0),
  taxAmount: real('tax_amount').default(0),
  finalAmount: real('final_amount').notNull().default(0),
  paymentMethod: text('payment_method').default('cash'), // 'cash', 'transfer', 'card'
  paymentStatus: text('payment_status').notNull().default('unpaid'), // 'unpaid', 'paid'
  customerCount: integer('customer_count').default(1),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
  paidAt: text('paid_at'),
  cancelledAt: text('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
  refundedAt: text('refunded_at'),
  refundedBy: integer('refunded_by').references(() => users.id),
  refundReason: text('refund_reason'),
  refundAmount: real('refund_amount').default(0),
});

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  productPrice: real('product_price').notNull(),
  unitCost: real('unit_cost').default(0),
  quantity: integer('quantity').notNull().default(1),
  amount: real('amount').notNull(),
  note: text('note'), // 'Ghi chú món: Ít cay, Không hành...'
  status: text('status').notNull().default('served'), // 'pending', 'cooking', 'served', 'cancelled'
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// 7. Audit Logs (Nhật ký thao tác tài chính / nhạy cảm)
// -------------------------------------------------------------
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(), // 'ORDER_CANCELLED', 'ORDER_REFUNDED', 'PAYMENT_COMPLETED', 'INVENTORY_RESTORED'
  entityType: text('entity_type').notNull().default('order'),
  entityId: integer('entity_id').notNull(),
  performedBy: integer('performed_by').references(() => users.id),
  reason: text('reason'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// 5. Cash Shifts & Transactions (Quản lý ca & Giao két)
// -------------------------------------------------------------
export const cashShifts = sqliteTable('cash_shifts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  shiftName: text('shift_name').notNull(), // 'Ca Sáng (08:00 - 16:00)', 'Ca Tối (16:00 - 24:00)'
  startTime: text('start_time').default(sql`(CURRENT_TIMESTAMP)`),
  endTime: text('end_time'),
  initialCash: real('initial_cash').notNull().default(0), // Tiền bàn giao đầu ca
  closingCash: real('closing_cash'), // Tiền thực tế kiểm đếm khi chốt ca
  totalCashSales: real('total_cash_sales').default(0),
  totalTransferSales: real('total_transfer_sales').default(0),
  totalExpenses: real('total_expenses').default(0),
  expectedCash: real('expected_cash').default(0),
  differenceAmount: real('difference_amount').default(0), // Lệch thừa/thiếu
  status: text('status').notNull().default('open'), // 'open', 'closed'
  notes: text('notes'),
});

export const cashTransactions = sqliteTable('cash_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftId: integer('shift_id').references(() => cashShifts.id),
  type: text('type').notNull(), // 'in' (Thu ngoài/nạp thêm), 'out' (Chi mua đá/nguyên liệu khẩn cấp)
  amount: real('amount').notNull(),
  reason: text('reason').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// 6. Inventory Logs (Theo dõi xuất/nhập tồn kho)
// -------------------------------------------------------------
export const inventoryLogs = sqliteTable('inventory_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  type: text('type').notNull(), // 'import', 'export', 'order_deduct', 'adjustment'
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  note: text('note'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// -------------------------------------------------------------
// Drizzle Relations Map
// -------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  orders: many(orders),
  shifts: many(cashShifts),
}));

export const areasRelations = relations(areas, ({ many }) => ({
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  area: one(areas, { fields: [tables.areaId], references: [areas.id] }),
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderItems: many(orderItems),
  inventoryLogs: many(inventoryLogs),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

// -------------------------------------------------------------
// 7. Settings (Cấu hình hệ thống)
// -------------------------------------------------------------
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
});

