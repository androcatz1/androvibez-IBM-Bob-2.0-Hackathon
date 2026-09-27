# Architecture

## Layers

**Controllers** receive HTTP requests, call services, return responses. No business logic here.

**Services** contain business logic. They coordinate between repositories and other services.

**Repositories** talk to the database. Each repository owns one table (roughly).

## Key services

- `OrderService` — creates orders, validates stock, manages status transitions
- `PaymentService` — processes payments, triggers inventory and notification side effects
- `InventoryService` — manages stock reservation and fulfillment
- `NotificationService` — records notifications for users

## Database

SQLite with WAL mode. Schema is in `database/schema.sql` and applied on startup.

Tables: `users`, `products`, `orders`, `order_items`, `payments`, `notifications`

## Dependency wiring

Services and repositories are instantiated in `src/routes/index.ts` and passed via constructor injection.
