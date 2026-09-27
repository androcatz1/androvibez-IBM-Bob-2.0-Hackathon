import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationType } from '../models/types';

export class NotificationRepository {
  constructor(private db: Database.Database) {}

  create(userId: string, type: NotificationType, message: string): Notification {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO notifications (id, user_id, type, message, sent_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId, type, message, now);
    return this.findById(id)!;
  }

  findById(id: string): Notification | undefined {
    return this.db
      .prepare('SELECT * FROM notifications WHERE id = ?')
      .get(id) as Notification | undefined;
  }

  findByUserId(userId: string): Notification[] {
    return this.db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY sent_at DESC')
      .all(userId) as Notification[];
  }
}
