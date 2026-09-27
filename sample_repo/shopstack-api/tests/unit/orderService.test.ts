import { createTestDatabase } from '../../src/config/database';
import { UserRepository } from '../../src/repositories/userRepository';
import { ProductRepository } from '../../src/repositories/productRepository';
import { OrderRepository } from '../../src/repositories/orderRepository';
import { InventoryService } from '../../src/services/inventoryService';
import { OrderService } from '../../src/services/orderService';

let userRepo: UserRepository;
let productRepo: ProductRepository;
let orderService: OrderService;

beforeEach(() => {
  const db = createTestDatabase();
  userRepo = new UserRepository(db);
  productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);
  const inventoryService = new InventoryService(productRepo);
  orderService = new OrderService(orderRepo, productRepo, inventoryService);
});

function seedUser() {
  return userRepo.create({ email: `u${Date.now()}@test.com`, name: 'Test User' });
}

function seedProduct(stock = 10, price = 20) {
  return productRepo.create({ name: 'Gadget', sku: `G-${Date.now()}`, price, stock_quantity: stock });
}

test('createOrder reserves inventory and returns order', async () => {
  const user = seedUser();
  const product = seedProduct(5);

  const order = await orderService.createOrder({
    user_id: user.id,
    items: [{ product_id: product.id, quantity: 2 }],
  });

  expect(order.status).toBe('pending');
  expect(order.total_amount).toBe(40);

  const updated = productRepo.findById(product.id)!;
  expect(updated.reserved_quantity).toBe(2);
});

test('createOrder fails when stock is insufficient', async () => {
  const user = seedUser();
  const product = seedProduct(1);

  await expect(
    orderService.createOrder({ user_id: user.id, items: [{ product_id: product.id, quantity: 5 }] })
  ).rejects.toThrow('Insufficient stock');
});

test('cancelling a pending order releases reserved inventory', async () => {
  const user = seedUser();
  const product = seedProduct(5);

  const order = await orderService.createOrder({
    user_id: user.id,
    items: [{ product_id: product.id, quantity: 3 }],
  });

  orderService.updateStatus(order.id, 'cancelled');

  const updated = productRepo.findById(product.id)!;
  expect(updated.reserved_quantity).toBe(0);
});

// Business rule: shipped/completed orders cannot be cancelled
test('cannot cancel an order that has already shipped', async () => {
  const user = seedUser();
  const product = seedProduct(5);
  const order = await orderService.createOrder({
    user_id: user.id,
    items: [{ product_id: product.id, quantity: 1 }],
  });

  orderService.updateStatus(order.id, 'paid');
  orderService.updateStatus(order.id, 'shipped');

  expect(() => orderService.updateStatus(order.id, 'cancelled')).toThrow('cannot be cancelled');
});
