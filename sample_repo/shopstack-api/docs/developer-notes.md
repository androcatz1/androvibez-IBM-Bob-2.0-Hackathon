# Developer notes

## Stock model

Products have two stock fields: `stock_quantity` and `reserved_quantity`.

Available stock = `stock_quantity - reserved_quantity`.

Reservations happen at order creation. Stock is only deducted after a successful payment.

## Payment simulation

There's no real payment gateway. `PaymentService.simulatePaymentGateway()` fakes one. It fails ~20% of the time. Useful for testing failure paths without mocking.

## Order statuses

The README lists the happy path. There are additional statuses used in failure cases — check `src/models/types.ts` for the full list.

## Testing

Tests use an in-memory SQLite database (`createTestDatabase()` in `src/config/database.ts`). Each test file gets a fresh database via `beforeEach`.

Some payment-related tests are light. The `simulatePaymentGateway` randomness makes end-to-end payment tests tricky without mocking.

## TODOs

- Authentication is not implemented. The `role` field exists on users but nothing enforces it.
- `returnStock` in `InventoryService` restores `stock_quantity` directly — this may not account correctly for in-flight reservations.
- No pagination on list endpoints.
