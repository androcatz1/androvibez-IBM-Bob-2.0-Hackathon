import { createTestDatabase } from '../../src/config/database';
import { UserRepository } from '../../src/repositories/userRepository';
import { ProductRepository } from '../../src/repositories/productRepository';
import { OrderRepository } from '../../src/repositories/orderRepository';
import { PaymentRepository } from '../../src/repositories/paymentRepository';
import { NotificationRepository } from '../../src/repositories/notificationRepository';
import { InventoryService } from '../../src/services/inventoryService';
import { NotificationService } from '../../src/services/notificationService';
import { OrderService } from '../../src/services/orderService';
import { PaymentService } from '../../src/services/paymentService';

let userRepo: UserRepository;
let productRepo: ProductRepository;
let orderService: OrderService;
let paymentService: PaymentService;
let paymentRepo: PaymentRepository;

beforeEach(() => {
  const db = createTestDatabase();
  userRepo = new UserRepository(db);
  productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);
  paymentRepo = new PaymentRepository(db);
  const notificationRepo = new NotificationRepository(db);
  const inventoryService = new InventoryService(productRepo);
  const notificationService = new NotificationService(notificationRepo);
  orderService = new OrderService(orderRepo, productRepo, inventoryService);
  paymentService = new PaymentService(paymentRepo, orderRepo, userRepo, inventoryService, notificationService);
});

function seedUser() {
  return userRepo.create({ email: `u${Date.now()}@test.com`, name: 'Buyer' });
}

function seedProduct(price = 10, stock = 5) {
  return productRepo.create({ name: 'Item', sku: `I-${Date.now()}`, price, stock_quantity: stock });
}

// Business rule: amounts ending in .99 always fail (see paymentService simulatePaymentGateway)
test('payment with x.99 total always fails and releases inventory', async () => {
  const user = seedUser();
  // price 9.99 × 1 = 9.99 — triggers forced failure
  const product = seedProduct(9.99, 5);

  const order = await orderService.createOrder({
    user_id: user.id,
    items: [{ product_id: product.id, quantity: 1 }],
  });

  const payment = await paymentService.processPayment({ order_id: order.id, method: 'card' });

  expect(payment.status).toBe('failed');

  const updatedProduct = productRepo.findById(product.id)!;
  expect(updatedProduct.reserved_quantity).toBe(0); // inventory released on failure
});

test('refund fails if payment is not completed', async () => {
  const user = seedUser();
  const product = seedProduct(9.99, 5); // forces failure
  const order = await orderService.createOrder({
    user_id: user.id,
    items: [{ product_id: product.id, quantity: 1 }],
  });
  await paymentService.processPayment({ order_id: order.id, method: 'card' });

  await expect(paymentService.refundPayment(order.id)).rejects.toThrow(
    'Only completed payments can be refunded'
  );
});
