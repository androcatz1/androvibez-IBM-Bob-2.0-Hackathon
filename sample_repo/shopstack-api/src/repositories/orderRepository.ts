import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem, OrderStatus } from '../models/types';

export class OrderRepository {
  constructor(private db: Database.Database) {}

  findById(id: string): Order | undefined {
    const order = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
    if (!order) return undefined;
    order.items = this.findItemsByOrderId(id);
    return order;
  }

  findByUserId(userId: string): Order[] {
    const orders = this.db
      .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Order[];
    return orders.map((o) => ({ ...o, items: this.findItemsByOrderId(o.id) }));
  }

  findItemsByOrderId(orderId: string): OrderItem[] {
    return this.db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .all(orderId) as OrderItem[];
  }

  create(userId: string, totalAmount: number, items: Array<{ product_id: string; quantity: number; unit_price: number }>): Order {
    const orderId = uuidv4();
    const now = new Date().toISOString();

    const insertOrder = this.db.prepare(
      `INSERT INTO orders (id, user_id, status, total_amount, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?, ?)`
    );
    const insertItem = this.db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?)`
    );

    const createTransaction = this.db.transaction(() => {
      insertOrder.run(orderId, userId, totalAmount, now, now);
      for (const item of items) {
        insertItem.run(uuidv4(), orderId, item.product_id, item.quantity, item.unit_price);
      }
    });

    createTransaction();
    return this.findById(orderId)!;
  }

  updateStatus(id: string, status: OrderStatus): Order | undefined {
    this.db.prepare(
      `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`
    ).run(status, new Date().toISOString(), id);
    return this.findById(id);
  }
}
