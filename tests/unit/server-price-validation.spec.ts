import { describe, it, expect, beforeAll } from 'vitest';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { db } from '../../src/db';
import { products, tables } from '../../src/db/schema';
import { setup } from '../setup/db';
import { eq } from 'drizzle-orm';
import { signJWT } from '../../src/lib/auth';

beforeAll(async () => {
  await setup();
});

describe('Server Price Validation', () => {
  it('should ignore client-provided productPrice and calculate from DB', async () => {
    // 1. Setup Mock Admin Request (so we have permission)
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    
    // Grab table and product
    const tableList = await db.select().from(tables).limit(1);
    const prodList = await db.select().from(products).limit(1);
    const table = tableList[0];
    const product = prodList[0];
    const actualPrice = product.price;

    // Fake malicious price
    const maliciousPrice = 1; // hacker tries to buy for 1 VND

    const requestBody = {
      tableId: table.id,
      items: [
        {
          productId: product.id,
          productName: product.name,
          productPrice: maliciousPrice, // Client sends hacked price
          quantity: 2,
        }
      ],
    };

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `pos_token=${token}`
      },
      body: JSON.stringify(requestBody),
    });

    const response = await createOrder(req);
    const result = await response.json();
    if (!result.success) throw new Error('API Error: ' + result.error);

    expect(result.success).toBe(true);

    // 2. Validate resulting order totals
    // If the server is correctly validating, finalAmount should be actualPrice * 2
    // If it trusts the client, it will be maliciousPrice * 2 (which is 2)
    const expectedCorrectAmount = actualPrice * 2;
    
    expect(result.data.finalAmount).toBe(expectedCorrectAmount);
  });
});
