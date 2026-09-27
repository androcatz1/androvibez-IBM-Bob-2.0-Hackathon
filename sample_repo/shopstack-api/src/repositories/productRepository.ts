import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Product, CreateProductInput } from '../models/types';

export class ProductRepository {
  constructor(private db: Database.Database) {}

  findById(id: string): Product | undefined {
    return this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
  }

  findBySku(sku: string): Product | undefined {
    return this.db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
  }

  findAll(): Product[] {
    return this.db.prepare('SELECT * FROM products ORDER BY name ASC').all() as Product[];
  }

  create(input: CreateProductInput): Product {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO products (id, name, description, price, stock_quantity, reserved_quantity, sku, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(id, input.name, input.description ?? null, input.price, input.stock_quantity, input.sku, now, now);
    return this.findById(id)!;
  }

  updateStock(id: string, quantity: number): void {
    this.db.prepare(
      `UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?`
    ).run(quantity, new Date().toISOString(), id);
  }

  // Increments reserved_quantity; does NOT decrement stock yet.
  // Stock is only decremented when an order is fulfilled.
  reserveStock(id: string, quantity: number): void {
    this.db.prepare(
      `UPDATE products SET reserved_quantity = reserved_quantity + ?, updated_at = ? WHERE id = ?`
    ).run(quantity, new Date().toISOString(), id);
  }

  releaseReservation(id: string, quantity: number): void {
    this.db.prepare(
      `UPDATE products SET reserved_quantity = MAX(0, reserved_quantity - ?), updated_at = ? WHERE id = ?`
    ).run(quantity, new Date().toISOString(), id);
  }

  // Called when an order is actually fulfilled (paid)
  deductStock(id: string, quantity: number): void {
    this.db.prepare(
      `UPDATE products
       SET stock_quantity = stock_quantity - ?,
           reserved_quantity = MAX(0, reserved_quantity - ?),
           updated_at = ?
       WHERE id = ?`
    ).run(quantity, quantity, new Date().toISOString(), id);
  }

  // Returns the number of units available to be sold right now
  getAvailableQuantity(id: string): number {
    const product = this.findById(id);
    if (!product) return 0;
    return product.stock_quantity - product.reserved_quantity;
  }
}
