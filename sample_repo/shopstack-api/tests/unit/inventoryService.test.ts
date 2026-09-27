import { createTestDatabase } from '../../src/config/database';
import { ProductRepository } from '../../src/repositories/productRepository';
import { InventoryService } from '../../src/services/inventoryService';

let productRepo: ProductRepository;
let inventoryService: InventoryService;

beforeEach(() => {
  const db = createTestDatabase();
  productRepo = new ProductRepository(db);
  inventoryService = new InventoryService(productRepo);
});

function seedProduct(stock = 10) {
  return productRepo.create({ name: 'Widget', sku: `SKU-${Date.now()}`, price: 9.99, stock_quantity: stock });
}

test('isAvailable returns true when stock is sufficient', () => {
  const p = seedProduct(5);
  expect(inventoryService.isAvailable(p.id, 5)).toBe(true);
});

test('isAvailable returns false when quantity exceeds available stock', () => {
  const p = seedProduct(3);
  expect(inventoryService.isAvailable(p.id, 4)).toBe(false);
});

test('reserveStock reduces available quantity without touching stock_quantity', () => {
  const p = seedProduct(10);
  inventoryService.reserveStock(p.id, 4);
  expect(inventoryService.isAvailable(p.id, 7)).toBe(false); // only 6 left
  expect(inventoryService.isAvailable(p.id, 6)).toBe(true);
});

test('reserveStock throws when requested quantity exceeds available', () => {
  const p = seedProduct(2);
  expect(() => inventoryService.reserveStock(p.id, 5)).toThrow('Insufficient stock');
});

test('releaseReservation makes stock available again', () => {
  const p = seedProduct(5);
  inventoryService.reserveStock(p.id, 5);
  expect(inventoryService.isAvailable(p.id, 1)).toBe(false);
  inventoryService.releaseReservation(p.id, 5);
  expect(inventoryService.isAvailable(p.id, 5)).toBe(true);
});

test('fulfillReservation deducts from stock_quantity', () => {
  const p = seedProduct(10);
  inventoryService.reserveStock(p.id, 3);
  inventoryService.fulfillReservation(p.id, 3);
  const updated = productRepo.findById(p.id)!;
  expect(updated.stock_quantity).toBe(7);
  expect(updated.reserved_quantity).toBe(0);
});
