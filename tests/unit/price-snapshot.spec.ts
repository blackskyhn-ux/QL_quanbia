import { describe, it, expect, beforeAll } from 'vitest';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { db } from '../../src/db';
import { orderItems, products, tables } from '../../src/db/schema';
import { setup } from '../setup/db';
import { eq } from 'drizzle-orm';
import { signJWT } from '../../src/lib/auth';

beforeAll(async () => {
  await setup();
});

describe('Price Snapshot Validation', () => {
  it('should preserve order item price even if the product price is updated later', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    
    // 1. Fetch table & product
    const [table] = await db.select().from(tables).where(eq(tables.name, 'B03'));
    const [product] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
    
    const originalPrice = product.price; // Let's say 45000

    // 2. Create order with current price
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: originalPrice, quantity: 1 }]
      }),
    });
    
    const res = await createOrder(req);
    const { data: { orderId } } = await res.json();

    // 3. Update the global product price in the DB
    const newPrice = 60000;
    await db.update(products).set({ price: newPrice }).where(eq(products.id, product.id));

    // 4. Checking the order_items table directy (or via API) to see if price was preserved
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    
    // The previous item's price MUST remain originalPrice (45000)
    expect(items[0].productPrice).toBe(originalPrice);
  });
});
