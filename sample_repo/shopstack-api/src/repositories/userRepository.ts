import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserInput, UpdateUserInput } from '../models/types';

export class UserRepository {
  constructor(private db: Database.Database) {}

  findById(id: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  findByEmail(email: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  }

  findAll(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  }

  create(input: CreateUserInput): User {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.email, input.name, input.role ?? 'customer', now, now);
    return this.findById(id)!;
  }

  update(id: string, input: UpdateUserInput): User | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };

    this.db.prepare(
      `UPDATE users SET email = ?, name = ?, updated_at = ? WHERE id = ?`
    ).run(updated.email, updated.name, updated.updated_at, id);

    return this.findById(id);
  }
}
