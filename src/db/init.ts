import { db, client } from './index';
import * as schema from './schema';
import bcrypt from 'bcryptjs';

let isInitialized = false;

export async function ensureDbInitialized() {
  if (isInitialized) return;

  // FAST-PATH: Single 20ms check query. If tables exist, skip all 24+ DDL network calls!
  try {
    const existingUsers = await db.select().from(schema.users).limit(1);
    if (existingUsers.length > 0) {
      isInitialized = true;
      return;
    }
  } catch {
    // Tables not created yet, proceed to create DDL
  }

  try {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role_id INTEGER REFERENCES roles(id),
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        seats INTEGER DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'available',
        current_order_id INTEGER,
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'Beer',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        price REAL NOT NULL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'Đĩa',
        stock_quantity INTEGER DEFAULT 100,
        min_stock_level INTEGER DEFAULT 10,
        is_available INTEGER DEFAULT 1,
        image_url TEXT,
        description TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        table_id INTEGER REFERENCES tables(id),
        user_id INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'serving',
        total_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        final_amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        customer_count INTEGER DEFAULT 1,
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        paid_at TEXT,
        cancelled_at TEXT,
        cancelled_by INTEGER REFERENCES users(id),
        cancel_reason TEXT,
        refunded_at TEXT,
        refunded_by INTEGER REFERENCES users(id),
        refund_reason TEXT,
        refund_amount REAL DEFAULT 0
      );`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        unit_cost REAL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        amount REAL NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'served',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'order',
        entity_id INTEGER NOT NULL,
        performed_by INTEGER REFERENCES users(id),
        reason TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS cash_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        shift_name TEXT NOT NULL,
        start_time TEXT DEFAULT (CURRENT_TIMESTAMP),
        end_time TEXT,
        initial_cash REAL NOT NULL DEFAULT 0,
        closing_cash REAL,
        total_cash_sales REAL DEFAULT 0,
        total_transfer_sales REAL DEFAULT 0,
        total_expenses REAL DEFAULT 0,
        expected_cash REAL DEFAULT 0,
        difference_amount REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        notes TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS cash_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER REFERENCES cash_shifts(id),
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS inventory_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id),
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        note TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT
      );`
    ];

    // 1. Create tables one by one safely
    for (const q of tableQueries) {
      try {
        await client.execute(q);
      } catch (e) {
        console.warn('Table create step skipped/failed:', (e as Error).message);
      }
    }

    // 1b. Ensure new columns and performance indexes exist on existing tables (Turso schema migration)
    const alterQueries = [
      `ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;`,
      `ALTER TABLE orders ADD COLUMN cancelled_at TEXT;`,
      `ALTER TABLE orders ADD COLUMN cancelled_by INTEGER;`,
      `ALTER TABLE orders ADD COLUMN cancel_reason TEXT;`,
      `ALTER TABLE orders ADD COLUMN refunded_at TEXT;`,
      `ALTER TABLE orders ADD COLUMN refunded_by INTEGER;`,
      `ALTER TABLE orders ADD COLUMN refund_reason TEXT;`,
      `ALTER TABLE orders ADD COLUMN refund_amount REAL DEFAULT 0;`,
      `ALTER TABLE order_items ADD COLUMN unit_cost REAL DEFAULT 0;`,
      `ALTER TABLE order_items ADD COLUMN note TEXT;`,
      `ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tables_area_id ON tables(area_id);`,
      `CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);`
    ];

    for (const alterQ of alterQueries) {
      try {
        await client.execute(alterQ);
      } catch {
        // Column already exists
      }
    }

    // 2. Safely check if users exist
    let hasUsers = false;
    try {
      const existingUsers = await db.select().from(schema.users).limit(1);
      hasUsers = existingUsers.length > 0;
    } catch {
      hasUsers = false;
    }

    if (!hasUsers) {
      console.log('🌱 Database is empty. Seeding initial data...');

      // Seed roles
      const insertedRoles = await db
        .insert(schema.roles)
        .values([
          { name: 'admin', description: 'Quản trị viên hệ thống' },
          { name: 'manager', description: 'Quản lý cửa hàng / Ca trưởng' },
          { name: 'cashier', description: 'Thu ngân thanh toán' },
          { name: 'staff', description: 'Nhân viên phục vụ' },
        ])
        .onConflictDoNothing()
        .returning();

      let adminRole = insertedRoles.find((r) => r.name === 'admin');
      let cashierRole = insertedRoles.find((r) => r.name === 'cashier');

      if (!adminRole) {
        const allRoles = await db.select().from(schema.roles);
        adminRole = allRoles.find((r) => r.name === 'admin');
        cashierRole = allRoles.find((r) => r.name === 'cashier');
      }

      // Seed users
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const cashierPasswordHash = await bcrypt.hash('cashier123', 10);

      await db.insert(schema.users).values([
        {
          username: 'admin',
          passwordHash: adminPasswordHash,
          fullName: 'Quản Trị Viên (Admin)',
          roleId: adminRole?.id,
          phone: '0988888888',
          status: 'active',
        },
        {
          username: 'thungan1',
          passwordHash: cashierPasswordHash,
          fullName: 'Thu Ngân Nguyễn Văn A',
          roleId: cashierRole?.id,
          phone: '0977777777',
          status: 'active',
        },
      ]).onConflictDoNothing();

      // Seed areas
      const insertedAreas = await db
        .insert(schema.areas)
        .values([
          { name: 'Tầng 1 (Sảnh Chính)', sortOrder: 1, isActive: true },
          { name: 'Tầng 2 (Phòng VIP)', sortOrder: 2, isActive: true },
          { name: 'Sân Vườn (Ngoài Trời)', sortOrder: 3, isActive: true },
        ])
        .returning();

      if (insertedAreas.length > 0) {
        const areaTang1 = insertedAreas[0];
        const areaTang2 = insertedAreas[1];
        const areaSanVuon = insertedAreas[2];

        // Seed tables
        await db.insert(schema.tables).values([
          { areaId: areaTang1.id, name: 'Bàn 01', seats: 4, status: 'available' },
          { areaId: areaTang1.id, name: 'Bàn 02', seats: 4, status: 'available' },
          { areaId: areaTang1.id, name: 'Bàn 03', seats: 6, status: 'available' },
          { areaId: areaTang1.id, name: 'Bàn 04', seats: 6, status: 'available' },
          { areaId: areaTang1.id, name: 'Bàn 05', seats: 8, status: 'available' },
          { areaId: areaTang1.id, name: 'Bàn 06', seats: 10, status: 'available' },
          { areaId: areaTang2.id, name: 'Bàn VIP 01', seats: 10, status: 'available' },
          { areaId: areaTang2.id, name: 'Bàn VIP 02', seats: 12, status: 'available' },
          { areaId: areaTang2.id, name: 'Bàn VIP 03', seats: 15, status: 'available' },
          { areaId: areaSanVuon.id, name: 'Sân Vườn 01', seats: 6, status: 'available' },
          { areaId: areaSanVuon.id, name: 'Sân Vườn 02', seats: 6, status: 'available' },
          { areaId: areaSanVuon.id, name: 'Sân Vườn 03', seats: 8, status: 'available' },
        ]);
      }

      // Seed categories
      const insertedCategories = await db
        .insert(schema.categories)
        .values([
          { name: 'Bia Hơi & Bia Chai', icon: 'Beer', sortOrder: 1, isActive: true },
          { name: 'Món Nhậu Đặc Sản', icon: 'Utensils', sortOrder: 2, isActive: true },
          { name: 'Lẩu & Nướng', icon: 'Flame', sortOrder: 3, isActive: true },
          { name: 'Khai Vị & Ăn Vặt', icon: 'Cookie', sortOrder: 4, isActive: true },
          { name: 'Nước Giải Khát', icon: 'CupSoda', sortOrder: 5, isActive: true },
        ])
        .returning();

      if (insertedCategories.length > 0) {
        const catBia = insertedCategories[0];
        const catMonNhau = insertedCategories[1];
        const catLau = insertedCategories[2];
        const catKhaiVi = insertedCategories[3];
        const catNuocGiaiKhat = insertedCategories[4];

        // Seed products
        await db.insert(schema.products).values([
          {
            categoryId: catBia.id,
            name: 'Bia Hơi Hà Nội (Cốc)',
            code: 'BIA-HOI-COC',
            price: 15000,
            costPrice: 7000,
            unit: 'Cốc',
            stockQuantity: 500,
            minStockLevel: 50,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400',
            description: 'Bia hơi Hà Nội mát lạnh chuẩn vị',
          },
          {
            categoryId: catBia.id,
            name: 'Bia Hơi Hà Nội (Ca 2 Lít)',
            code: 'BIA-HOI-CA2L',
            price: 55000,
            costPrice: 25000,
            unit: 'Ca',
            stockQuantity: 100,
            minStockLevel: 10,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400',
            description: 'Ca 2L bia hơi tươi dùng cho nhóm',
          },
          {
            categoryId: catBia.id,
            name: 'Bia Heineken Silver (Chai)',
            code: 'BIA-KEN-SILVER',
            price: 25000,
            costPrice: 17000,
            unit: 'Chai',
            stockQuantity: 240,
            minStockLevel: 24,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=400',
            description: 'Heineken Silver 330ml mát lạnh',
          },
          {
            categoryId: catBia.id,
            name: 'Bia Tiger Crystal (Chai)',
            code: 'BIA-TIGER-CRYSTAL',
            price: 24000,
            costPrice: 16000,
            unit: 'Chai',
            stockQuantity: 240,
            minStockLevel: 24,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1584225065152-4a1454aa3d4e?w=400',
            description: 'Tiger bạc sảng khoái',
          },
          {
            categoryId: catBia.id,
            name: 'Bia Saigon Special (Lon)',
            code: 'BIA-SAIGON-SP',
            price: 22000,
            costPrice: 14000,
            unit: 'Lon',
            stockQuantity: 180,
            minStockLevel: 20,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=400',
            description: 'Bia Saigon lon lúa mạch chuẩn',
          },
          {
            categoryId: catMonNhau.id,
            name: 'Trâu Xào Măng Trúc',
            code: 'MON-TRAU-MANG',
            price: 150000,
            costPrice: 80000,
            unit: 'Đĩa',
            stockQuantity: 50,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
            description: 'Thịt trâu tươi xào măng trúc Yên Tử',
          },
          {
            categoryId: catMonNhau.id,
            name: 'Mực Nướng Hấp Dừa',
            code: 'MON-MUC-DUA',
            price: 180000,
            costPrice: 95000,
            unit: 'Đĩa',
            stockQuantity: 30,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
            description: 'Mực một nắng xé sợi hấp nước dừa',
          },
          {
            categoryId: catMonNhau.id,
            name: 'Gà Nướng Mắc Mật (Nửa con)',
            code: 'MON-GA-MACMAT',
            price: 160000,
            costPrice: 85000,
            unit: 'Đĩa',
            stockQuantity: 40,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
            description: 'Gà ta thả vườn nướng lá mắc mật',
          },
          {
            categoryId: catMonNhau.id,
            name: 'Đậu Lướt Ván Mắm Tôm',
            code: 'MON-DAU-LUOT',
            price: 45000,
            costPrice: 15000,
            unit: 'Đĩa',
            stockQuantity: 100,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            description: 'Đậu hũ chiên giòn ngoài mềm trong kèm mắm tôm',
          },
          {
            categoryId: catMonNhau.id,
            name: 'Chả Ốc Hà Thành',
            code: 'MON-CHA-OC',
            price: 120000,
            costPrice: 60000,
            unit: 'Đĩa',
            stockQuantity: 40,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
            description: 'Chả ốc lá lốt giòn sần sật',
          },
          {
            categoryId: catLau.id,
            name: 'Lẩu Riêu Cua Bắp Bò (Nồi lớn)',
            code: 'LAU-RIEU-CUA',
            price: 380000,
            costPrice: 200000,
            unit: 'Nồi',
            stockQuantity: 20,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400',
            description: 'Lẩu riêu cua đồng, sườn sụn, bắp bò tươi',
          },
          {
            categoryId: catLau.id,
            name: 'Lẩu Ếch Măng Cay',
            code: 'LAU-ECH-MANG',
            price: 320000,
            costPrice: 160000,
            unit: 'Nồi',
            stockQuantity: 25,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400',
            description: 'Lẩu ếch xào măng củ cay nồng đậm đà',
          },
          {
            categoryId: catKhaiVi.id,
            name: 'Lạc Rang Muối / Bánh Đa Tôm',
            code: 'KV-LAC-BANHDA',
            price: 20000,
            costPrice: 6000,
            unit: 'Đĩa',
            stockQuantity: 200,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400',
            description: 'Mon nhậu quốc dân nhắm bia',
          },
          {
            categoryId: catKhaiVi.id,
            name: 'Nem Chua Thanh Hóa (10 chiếc)',
            code: 'KV-NEM-CHUA',
            price: 60000,
            costPrice: 35000,
            unit: 'Đĩa',
            stockQuantity: 50,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400',
            description: 'Nem chua Thanh Hóa chuẩn cay tỏi ớt',
          },
          {
            categoryId: catNuocGiaiKhat.id,
            name: 'Coca Cola (Lon)',
            code: 'NC-COCA',
            price: 18000,
            costPrice: 10000,
            unit: 'Lon',
            stockQuantity: 120,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400',
            description: 'Coca cola lon 330ml',
          },
          {
            categoryId: catNuocGiaiKhat.id,
            name: 'Bò Húc RedBull',
            code: 'NC-REDBULL',
            price: 22000,
            costPrice: 13000,
            unit: 'Lon',
            stockQuantity: 100,
            isAvailable: true,
            imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400',
            description: 'Nước tăng lực RedBull Thái',
          },
        ]);
      }
    }

    isInitialized = true;
  } catch (err) {
    console.error('ensureDbInitialized error:', err);
  }
}
