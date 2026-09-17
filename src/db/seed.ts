import { db } from './index';
import * as schema from './schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Đang khởi tạo dữ liệu mẫu cho Quán Bia POS...');

  // 1. Clear existing data in reverse order of dependencies
  await db.delete(schema.inventoryLogs);
  await db.delete(schema.cashTransactions);
  await db.delete(schema.cashShifts);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.products);
  await db.delete(schema.categories);
  await db.delete(schema.tables);
  await db.delete(schema.areas);
  await db.delete(schema.users);
  await db.delete(schema.roles);

  console.log('✅ Đã dọn dẹp bảng CSDL cũ.');

  // 2. Insert Roles
  const insertedRoles = await db
    .insert(schema.roles)
    .values([
      { name: 'admin', description: 'Quản trị viên hệ thống' },
      { name: 'manager', description: 'Quản lý cửa hàng / Ca trưởng' },
      { name: 'cashier', description: 'Thu ngân thanh toán' },
      { name: 'staff', description: 'Nhân viên phục vụ' },
    ])
    .returning();

  const adminRole = insertedRoles.find((r) => r.name === 'admin');
  const cashierRole = insertedRoles.find((r) => r.name === 'cashier');

  // 3. Insert Users
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const cashierPasswordHash = await bcrypt.hash('cashier123', 10);

  const insertedUsers = await db
    .insert(schema.users)
    .values([
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
    ])
    .returning();

  // 4. Insert Areas
  const insertedAreas = await db
    .insert(schema.areas)
    .values([
      { name: 'Tầng 1 (Sảnh Chính)', sortOrder: 1, isActive: true },
      { name: 'Tầng 2 (Phòng VIP)', sortOrder: 2, isActive: true },
      { name: 'Sân Vườn (Ngoài Trời)', sortOrder: 3, isActive: true },
    ])
    .returning();

  const areaTang1 = insertedAreas[0];
  const areaTang2 = insertedAreas[1];
  const areaSanVuon = insertedAreas[2];

  // 5. Insert Tables
  await db.insert(schema.tables).values([
    // Tầng 1
    { areaId: areaTang1.id, name: 'Bàn 01', seats: 4, status: 'available' },
    { areaId: areaTang1.id, name: 'Bàn 02', seats: 4, status: 'available' },
    { areaId: areaTang1.id, name: 'Bàn 03', seats: 6, status: 'available' },
    { areaId: areaTang1.id, name: 'Bàn 04', seats: 6, status: 'available' },
    { areaId: areaTang1.id, name: 'Bàn 05', seats: 8, status: 'available' },
    { areaId: areaTang1.id, name: 'Bàn 06', seats: 10, status: 'available' },
    // Tầng 2 VIP
    { areaId: areaTang2.id, name: 'Bàn VIP 01', seats: 10, status: 'available' },
    { areaId: areaTang2.id, name: 'Bàn VIP 02', seats: 12, status: 'available' },
    { areaId: areaTang2.id, name: 'Bàn VIP 03', seats: 15, status: 'available' },
    // Sân vườn
    { areaId: areaSanVuon.id, name: 'Sân Vườn 01', seats: 6, status: 'available' },
    { areaId: areaSanVuon.id, name: 'Sân Vườn 02', seats: 6, status: 'available' },
    { areaId: areaSanVuon.id, name: 'Sân Vườn 03', seats: 8, status: 'available' },
  ]);

  // 6. Insert Categories
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

  const catBia = insertedCategories[0];
  const catMonNhau = insertedCategories[1];
  const catLau = insertedCategories[2];
  const catKhaiVi = insertedCategories[3];
  const catNuocGiaiKhat = insertedCategories[4];

  // 7. Insert Products
  await db.insert(schema.products).values([
    // Bia
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

    // Món nhậu đặc sản
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

    // Lẩu & Nướng
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

    // Khai vị
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

    // Nước giải khát
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

  console.log('🎉 Seed dữ liệu mẫu thành công!');
  console.log('🔑 Tài khoản Admin: admin / admin123');
  console.log('🔑 Tài khoản Thu Ngân: thungan1 / cashier123');
}

seed()
  .catch((err) => {
    console.error('❌ Lỗi seed data:', err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
