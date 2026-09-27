# shopstack-api

A simple e-commerce backend API built with Node.js, TypeScript, Express, and SQLite.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

The server starts at `http://localhost:3000`.

## Running tests

```bash
npm test
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/users | Create a user |
| GET | /api/users/:id | Get a user |
| PATCH | /api/users/:id | Update a user |
| GET | /api/products | List products |
| GET | /api/products/:id | Get a product |
| POST | /api/products | Create a product |
| PATCH | /api/products/:id/stock | Update stock quantity |
| POST | /api/orders | Create an order |
| GET | /api/orders/:id | Get an order |
| PATCH | /api/orders/:id/status | Update order status |
| POST | /api/orders/:id/pay | Process payment |
| POST | /api/orders/:id/refund | Refund an order |

## Architecture

```
controllers → services → repositories → SQLite
```

Services handle business logic. Repositories handle database access. Controllers handle HTTP.

Order flow: `pending → confirmed → paid → shipped → completed`

Orders can also become `cancelled` or `payment_failed`.

## Tech stack

- Node.js + TypeScript
- Express.js
- SQLite via better-sqlite3
- Jest for tests
