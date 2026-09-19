import { db } from '../../src/db';
import { roles, users, areas, tables, categories, products } from '../../src/db/schema';
import bcrypt from 'bcryptjs';

export async function seedTestDatabase() {
  // Roles
  const [adminRole] = await db.insert(roles).values({ name: 'admin' }).returning();
  const [managerRole] = await db.insert(roles).values({ name: 'manager' }).returning();
  const [staffRole] = await db.insert(roles).values({ name: 'staff' }).returning();

  // Users
  const salt = bcrypt.genSaltSync(10);
  const adminPwd = bcrypt.hashSync('admin123', salt);
  const staffPwd = bcrypt.hashSync('staffpassword', salt);
  
  await db.insert(users).values([
    { username: 'admin', passwordHash: adminPwd, fullName: 'Admin System', roleId: adminRole.id, status: 'active' },
    { username: 'staff1', passwordHash: staffPwd, fullName: 'Staff One', roleId: staffRole.id, status: 'active' },
  ]);

  // Areas
  const [area1] = await db.insert(areas).values({ name: 'Tầng 1' }).returning();

  // Tables
  await db.insert(tables).values([
    { areaId: area1.id, name: 'Bàn 01', status: 'available' },
    { areaId: area1.id, name: 'Bàn 02', status: 'available' },
    { areaId: area1.id, name: 'Bàn 03', status: 'available' },
  ]);

  // Categories
  const [catPho] = await db.insert(categories).values({ name: 'Phở' }).returning();
  const [catNuoc] = await db.insert(categories).values({ name: 'Đồ uống' }).returning();

  // Products
  await db.insert(products).values([
    { categoryId: catPho.id, name: 'Phở Bò Đặc Biệt', price: 55000, stockQuantity: 100, isAvailable: true },
    { categoryId: catPho.id, name: 'Trâu Xào Măng Trúc', price: 150000, stockQuantity: 100, isAvailable: true },
    { categoryId: catNuoc.id, name: 'Coca Cola Chai Glass', price: 15000, stockQuantity: 100, isAvailable: true },
    { categoryId: catNuoc.id, name: 'Bia Hơi Hà Nội (Cốc)', price: 15000, stockQuantity: 100, isAvailable: true },
    { categoryId: catNuoc.id, name: 'Coca Cola (Lon)', price: 18000, stockQuantity: 100, isAvailable: true },
  ]);
}
