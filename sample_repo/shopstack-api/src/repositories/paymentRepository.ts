import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentStatus, PaymentMethod } from '../models/types';

export class PaymentRepository {
  constructor(private db: Database.Database) {}

  findById(id: string): Payment | undefined {
    return this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as Payment | undefined;
  }

  findByOrderId(orderId: string): Payment | undefined {
    return this.db
      .prepare('SELECT * FROM payments WHERE order_id = ?')
      .get(orderId) as Payment | undefined;
  }

  create(orderId: string, amount: number, method: PaymentMethod): Payment {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO payments (id, order_id, amount, status, method, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`
    ).run(id, orderId, amount, method, now, now);
    return this.findById(id)!;
  }

  updateStatus(id: string, status: PaymentStatus, failureReason?: string): Payment | undefined {
    this.db.prepare(
      `UPDATE payments SET status = ?, failure_reason = ?, updated_at = ? WHERE id = ?`
    ).run(status, failureReason ?? null, new Date().toISOString(), id);
    return this.findById(id);
  }
}
