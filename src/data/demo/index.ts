import { BrowserRepositoryService } from '../../services/repository'
import type {
  ChangeImpactScenario,
  ContributionTask,
  InvestigationScenario,
  KnowledgeGap,
  LearningObjective,
  OnboardingPath,
  QuizQuestion,
  Quest,
  Repository,
  RepositoryAnalysis,
  RepositoryFile,
  RepositoryInput,
  UserProgress,
} from '../../types'

// ---------------------------------------------------------------------------
// ShopStack repository files — includes inline content so the AI parser
// can produce a fully ShopStack-specific analysis when the demo is loaded.
// ---------------------------------------------------------------------------

const repositoryFiles: RepositoryFile[] = [
  {
    id: 'file-readme',
    path: 'README.md',
    name: 'README.md',
    role: 'documentation',
    isDocumentation: true,
    sizeBytes: 917,
    content: `# shopstack-api\n\nA simple e-commerce backend API built with Node.js, TypeScript, Express, and SQLite.\n\n## Setup\n\n\`\`\`bash\ncp .env.example .env\nnpm install\nnpm run dev\n\`\`\`\n\nThe server starts at \`http://localhost:3000\`.\n\n## Running tests\n\n\`\`\`bash\nnpm test\n\`\`\`\n\n## Architecture\n\n\`\`\`\ncontrollers → services → repositories → SQLite\n\`\`\`\n\nServices handle business logic. Repositories handle database access. Controllers handle HTTP.\n\nOrder flow: \`pending → confirmed → paid → shipped → completed\`\n\nOrders can also become \`cancelled\` or \`payment_failed\`.\n\n## Tech stack\n\n- Node.js + TypeScript\n- Express.js\n- SQLite via better-sqlite3\n- Jest for tests`,
  },
  {
    id: 'file-package-json',
    path: 'package.json',
    name: 'package.json',
    role: 'configuration',
    sizeBytes: 832,
    content: `{\n  "name": "shopstack-api",\n  "version": "1.0.0",\n  "description": "E-commerce backend API for ShopStack",\n  "scripts": {\n    "dev": "ts-node-dev --respawn --transpile-only src/app.ts",\n    "build": "tsc",\n    "start": "node dist/app.js",\n    "test": "jest --runInBand --forceExit",\n    "test:unit": "jest tests/unit --runInBand --forceExit"\n  },\n  "dependencies": {\n    "better-sqlite3": "^11.0.0",\n    "express": "^4.18.2",\n    "uuid": "^9.0.0"\n  },\n  "devDependencies": {\n    "@types/better-sqlite3": "^7.6.13",\n    "@types/express": "^4.17.21",\n    "@types/jest": "^29.5.12",\n    "@types/node": "^20.11.5",\n    "jest": "^29.7.0",\n    "ts-jest": "^29.1.2",\n    "typescript": "^5.3.3"\n  }\n}`,
  },
  {
    id: 'file-app',
    path: 'src/app.ts',
    name: 'app.ts',
    language: 'TypeScript',
    role: 'source',
    isEntryPoint: true,
    sizeBytes: 330,
    content: `import express from 'express';\nimport { getDatabase } from './config/database';\nimport { createRouter } from './routes/index';\n\nconst app = express();\napp.use(express.json());\n\nconst db = getDatabase();\napp.use('/api', createRouter(db));\n\napp.get('/health', (_req, res) => res.json({ status: 'ok' }));\n\nconst PORT = process.env.PORT ?? 3000;\napp.listen(PORT, () => {\n  console.log(\`shopstack-api running on http://localhost:\${PORT}\`);\n});\n\nexport default app;`,
  },
  {
    id: 'file-routes',
    path: 'src/routes/index.ts',
    name: 'index.ts',
    language: 'TypeScript',
    role: 'source',
    sizeBytes: 1640,
    content: `import { Router } from 'express';\nimport Database from 'better-sqlite3';\nimport { UserRepository } from '../repositories/userRepository';\nimport { ProductRepository } from '../repositories/productRepository';\nimport { OrderRepository } from '../repositories/orderRepository';\nimport { PaymentRepository } from '../repositories/paymentRepository';\nimport { NotificationRepository } from '../repositories/notificationRepository';\nimport { InventoryService } from '../services/inventoryService';\nimport { NotificationService } from '../services/notificationService';\nimport { OrderService } from '../services/orderService';\nimport { PaymentService } from '../services/paymentService';\nimport { UserController } from '../controllers/userController';\nimport { ProductController } from '../controllers/productController';\nimport { OrderController } from '../controllers/orderController';\n\nexport function createRouter(db: Database.Database): Router {\n  const router = Router();\n  const userRepo = new UserRepository(db);\n  const productRepo = new ProductRepository(db);\n  const orderRepo = new OrderRepository(db);\n  const paymentRepo = new PaymentRepository(db);\n  const notificationRepo = new NotificationRepository(db);\n  const inventoryService = new InventoryService(productRepo);\n  const notificationService = new NotificationService(notificationRepo);\n  const orderService = new OrderService(orderRepo, productRepo, inventoryService);\n  const paymentService = new PaymentService(paymentRepo, orderRepo, userRepo, inventoryService, notificationService);\n  const userController = new UserController(userRepo);\n  const productController = new ProductController(productRepo);\n  const orderController = new OrderController(orderService, paymentService);\n  router.post('/users', userController.create);\n  router.get('/users/:id', userController.getById);\n  router.patch('/users/:id', userController.update);\n  router.get('/products', productController.list);\n  router.get('/products/:id', productController.getById);\n  router.post('/products', productController.create);\n  router.patch('/products/:id/stock', productController.updateStock);\n  router.post('/orders', orderController.create);\n  router.get('/orders/:id', orderController.getById);\n  router.patch('/orders/:id/status', orderController.updateStatus);\n  router.post('/orders/:id/pay', orderController.processPayment);\n  router.post('/orders/:id/refund', orderController.refund);\n  return router;\n}`,
  },
  {
    id: 'file-types',
    path: 'src/models/types.ts',
    name: 'types.ts',
    language: 'TypeScript',
    role: 'source',
    sizeBytes: 2400,
    content: `export type UserRole = 'customer' | 'admin';\nexport interface User { id: string; email: string; name: string; role: UserRole; created_at: string; updated_at: string; }\nexport interface CreateUserInput { email: string; name: string; role?: UserRole; }\nexport interface UpdateUserInput { name?: string; email?: string; }\n\nexport interface Product { id: string; name: string; description: string | null; price: number; stock_quantity: number; reserved_quantity: number; sku: string; created_at: string; updated_at: string; }\nexport interface CreateProductInput { name: string; description?: string; price: number; stock_quantity: number; sku: string; }\n\nexport type OrderStatus = 'pending' | 'confirmed' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'payment_failed' | 'refunded';\nexport interface OrderItem { id: string; order_id: string; product_id: string; quantity: number; unit_price: number; }\nexport interface Order { id: string; user_id: string; status: OrderStatus; total_amount: number; created_at: string; updated_at: string; items?: OrderItem[]; }\nexport interface CreateOrderInput { user_id: string; items: Array<{ product_id: string; quantity: number }>; }\n\nexport type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';\nexport type PaymentMethod = 'card' | 'bank_transfer' | 'wallet';\nexport interface Payment { id: string; order_id: string; amount: number; status: PaymentStatus; method: PaymentMethod; failure_reason: string | null; created_at: string; updated_at: string; }\nexport interface ProcessPaymentInput { order_id: string; method: PaymentMethod; }\n\nexport type NotificationType = 'order_confirmed' | 'order_shipped' | 'payment_failed' | 'order_cancelled' | 'refund_issued';\nexport interface Notification { id: string; user_id: string; type: NotificationType; message: string; sent_at: string; }\nexport interface ApiResponse<T> { success: boolean; data?: T; error?: string; }`,
  },
  {
    id: 'file-order-service',
    path: 'src/services/orderService.ts',
    name: 'orderService.ts',
    language: 'TypeScript',
    role: 'source',
    sizeBytes: 1900,
    content: `import { OrderRepository } from '../repositories/orderRepository';\nimport { ProductRepository } from '../repositories/productRepository';\nimport { InventoryService } from './inventoryService';\nimport { Order, CreateOrderInput, OrderStatus } from '../models/types';\n\nconst NON_CANCELLABLE_STATUSES: OrderStatus[] = ['shipped', 'completed', 'refunded'];\n\nexport class OrderService {\n  constructor(\n    private orderRepo: OrderRepository,\n    private productRepo: ProductRepository,\n    private inventoryService: InventoryService\n  ) {}\n\n  async createOrder(input: CreateOrderInput): Promise<Order> {\n    const itemsWithPrice = [];\n    let total = 0;\n    for (const item of input.items) {\n      const product = this.productRepo.findById(item.product_id);\n      if (!product) throw new Error(\`Product \${item.product_id} not found\`);\n      if (!this.inventoryService.isAvailable(item.product_id, item.quantity)) {\n        throw new Error(\`Insufficient stock for "\${product.name}"\`);\n      }\n      itemsWithPrice.push({ ...item, unit_price: product.price });\n      total += product.price * item.quantity;\n    }\n    for (const item of itemsWithPrice) {\n      this.inventoryService.reserveStock(item.product_id, item.quantity);\n    }\n    return this.orderRepo.create(input.user_id, total, itemsWithPrice);\n  }\n\n  updateStatus(id: string, status: OrderStatus): Order {\n    const order = this.orderRepo.findById(id);\n    if (!order) throw new Error(\`Order \${id} not found\`);\n    if (status === 'cancelled') {\n      if (NON_CANCELLABLE_STATUSES.includes(order.status)) {\n        throw new Error(\`Order cannot be cancelled in status "\${order.status}"\`);\n      }\n      if (order.status === 'pending' || order.status === 'confirmed') {\n        for (const item of order.items ?? []) {\n          this.inventoryService.releaseReservation(item.product_id, item.quantity);\n        }\n      }\n    }\n    return this.orderRepo.updateStatus(id, status)!;\n  }\n}`,
  },
  {
    id: 'file-payment-service',
    path: 'src/services/paymentService.ts',
    name: 'paymentService.ts',
    language: 'TypeScript',
    role: 'source',
    sizeBytes: 2600,
    content: `import { PaymentRepository } from '../repositories/paymentRepository';\nimport { OrderRepository } from '../repositories/orderRepository';\nimport { InventoryService } from './inventoryService';\nimport { NotificationService } from './notificationService';\nimport { UserRepository } from '../repositories/userRepository';\nimport { Payment, ProcessPaymentInput } from '../models/types';\n\nexport class PaymentService {\n  constructor(\n    private paymentRepo: PaymentRepository,\n    private orderRepo: OrderRepository,\n    private userRepo: UserRepository,\n    private inventoryService: InventoryService,\n    private notificationService: NotificationService\n  ) {}\n\n  async processPayment(input: ProcessPaymentInput): Promise<Payment> {\n    const order = this.orderRepo.findById(input.order_id);\n    if (!order) throw new Error(\`Order \${input.order_id} not found\`);\n    if (order.status !== 'pending' && order.status !== 'confirmed') {\n      throw new Error(\`Order is not in a payable state (current: \${order.status})\`);\n    }\n    const existing = this.paymentRepo.findByOrderId(input.order_id);\n    if (existing && existing.status === 'completed') throw new Error('Order has already been paid');\n    const payment = this.paymentRepo.create(order.id, order.total_amount, input.method);\n    const success = this.simulatePaymentGateway(order.total_amount);\n    if (success) {\n      this.paymentRepo.updateStatus(payment.id, 'completed');\n      this.orderRepo.updateStatus(order.id, 'paid');\n      for (const item of order.items ?? []) this.inventoryService.fulfillReservation(item.product_id, item.quantity);\n      const user = this.userRepo.findById(order.user_id);\n      if (user) this.notificationService.sendOrderConfirmation(user.id, order);\n      return this.paymentRepo.findById(payment.id)!;\n    } else {\n      const reason = 'Payment declined by gateway';\n      this.paymentRepo.updateStatus(payment.id, 'failed', reason);\n      this.orderRepo.updateStatus(order.id, 'payment_failed');\n      for (const item of order.items ?? []) this.inventoryService.releaseReservation(item.product_id, item.quantity);\n      const user = this.userRepo.findById(order.user_id);\n      if (user) this.notificationService.sendPaymentFailure(user.id, order, reason);\n      return this.paymentRepo.findById(payment.id)!;\n    }\n  }\n\n  // Simulates a payment gateway. Fails ~20% of the time.\n  // amounts ending in .99 always fail — useful for testing failure paths\n  private simulatePaymentGateway(amount: number): boolean {\n    if (Math.round(amount * 100) % 100 === 99) return false;\n    return Math.random() > 0.2;\n  }\n}`,
  },
  {
    id: 'file-inventory-service',
    path: 'src/services/inventoryService.ts',
    name: 'inventoryService.ts',
    language: 'TypeScript',
    role: 'source',
    sizeBytes: 1200,
    content: `import { ProductRepository } from '../repositories/productRepository';\n\nexport class InventoryService {\n  constructor(private productRepo: ProductRepository) {}\n\n  isAvailable(productId: string, quantity: number): boolean {\n    const available = this.productRepo.getAvailableQuantity(productId);\n    return available >= quantity;\n  }\n\n  // Reserve stock — does NOT deduct from actual stock, only marks units as reserved\n  reserveStock(productId: string, quantity: number): void {\n    if (!this.isAvailable(productId, quantity)) throw new Error(\`Insufficient stock for product \${productId}\`);\n    this.productRepo.reserveStock(productId, quantity);\n  }\n\n  // Release reservation — called when payment fails or order is cancelled before payment\n  releaseReservation(productId: string, quantity: number): void {\n    this.productRepo.releaseReservation(productId, quantity);\n  }\n\n  // Fulfill reservation — deduct from actual stock after successful payment\n  fulfillReservation(productId: string, quantity: number): void {\n    this.productRepo.deductStock(productId, quantity);\n  }\n\n  // Return stock after a refund\n  returnStock(productId: string, quantity: number): void {\n    const product = this.productRepo.findById(productId);\n    if (!product) throw new Error(\`Product \${productId} not found\`);\n    this.productRepo.updateStock(productId, product.stock_quantity + quantity);\n  }\n}`,
  },
  {
    id: 'file-schema',
    path: 'database/schema.sql',
    name: 'schema.sql',
    language: 'SQL',
    role: 'schema',
    sizeBytes: 1200,
    content: `-- ShopStack API Database Schema\nCREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));\nCREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, stock_quantity INTEGER NOT NULL DEFAULT 0, reserved_quantity INTEGER NOT NULL DEFAULT 0, sku TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));\nCREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', total_amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id));\nCREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id));\nCREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', method TEXT NOT NULL DEFAULT 'card', failure_reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (order_id) REFERENCES orders(id));\nCREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, message TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id));`,
  },
  {
    id: 'file-arch-doc',
    path: 'docs/architecture.md',
    name: 'architecture.md',
    role: 'documentation',
    isDocumentation: true,
    sizeBytes: 720,
    content: `# Architecture\n\n## Layers\n\n**Controllers** receive HTTP requests, call services, return responses. No business logic here.\n\n**Services** contain business logic. They coordinate between repositories and other services.\n\n**Repositories** talk to the database. Each repository owns one table (roughly).\n\n## Key services\n\n- OrderService — creates orders, validates stock, manages status transitions\n- PaymentService — processes payments, triggers inventory and notification side effects\n- InventoryService — manages stock reservation and fulfillment\n- NotificationService — records notifications for users\n\n## Dependency wiring\n\nServices and repositories are instantiated in src/routes/index.ts and passed via constructor injection.`,
  },
  {
    id: 'file-order-test',
    path: 'tests/unit/orderService.test.ts',
    name: 'orderService.test.ts',
    language: 'TypeScript',
    role: 'test',
    isTest: true,
    sizeBytes: 2100,
    content: `import { createTestDatabase } from '../../src/config/database';\nimport { UserRepository } from '../../src/repositories/userRepository';\nimport { ProductRepository } from '../../src/repositories/productRepository';\nimport { OrderRepository } from '../../src/repositories/orderRepository';\nimport { InventoryService } from '../../src/services/inventoryService';\nimport { OrderService } from '../../src/services/orderService';\n\nlet orderService: OrderService;\nbeforeEach(() => { /* setup */ });\n\ntest('createOrder reserves inventory and returns order', async () => { /* ... */ });\ntest('createOrder fails when stock is insufficient', async () => { /* ... */ });\ntest('cancelling a pending order releases reserved inventory', async () => { /* ... */ });\ntest('cannot cancel an order that has already shipped', async () => { /* ... */ });`,
  },
]

const objectives: LearningObjective[] = [
  { id: 'objective-map', title: 'Understand the layered architecture', description: 'Identify controllers, services, repositories and their responsibilities in shopstack-api.', level: 'introductory', measurableOutcomes: ['Name all four layers', 'Explain constructor injection'] },
  { id: 'objective-flow', title: 'Trace the order lifecycle', description: 'Follow a create-order request from the HTTP entry point through services and repositories.', level: 'intermediate', prerequisiteObjectiveIds: ['objective-map'] },
  { id: 'objective-quality', title: 'Understand inventory and payment rules', description: 'Explain stock reservation, payment processing, and the business rules that govern them.', level: 'intermediate', prerequisiteObjectiveIds: ['objective-flow'] },
]

const quests: Quest[] = [
  { id: 'quest-map', title: 'Explore the codebase', description: 'Discover the layers and how they connect in shopstack-api.', type: 'orientation', difficulty: 'introductory', status: 'available', estimatedMinutes: 12, objectiveIds: ['objective-map'], steps: [{ id: 'step-map-1', title: 'Find the entry point', description: 'Locate src/app.ts and trace how requests reach controllers.', relatedFileIds: ['file-app'], estimatedMinutes: 5 }, { id: 'step-map-2', title: 'Name the layers', description: 'Connect controllers, services, repositories, and the database.', relatedFileIds: ['file-routes', 'file-order-service', 'file-schema'], estimatedMinutes: 7 }] },
  { id: 'quest-flow', title: 'Trace a request', description: 'Follow an order creation from HTTP to SQLite.', type: 'code-tracing', difficulty: 'intermediate', status: 'locked', estimatedMinutes: 18, objectiveIds: ['objective-flow'], prerequisites: ['quest-map'], steps: [{ id: 'step-flow-1', title: 'Follow createOrder', description: 'Trace the full path from OrderController.create → OrderService.createOrder → OrderRepository → SQLite.', relatedFileIds: ['file-routes', 'file-order-service'], estimatedMinutes: 18 }] },
  { id: 'quest-quality', title: 'Understand inventory rules', description: 'Learn how stock reservation and payment interact.', type: 'quality', difficulty: 'intermediate', status: 'locked', estimatedMinutes: 14, objectiveIds: ['objective-quality'], prerequisites: ['quest-flow'], steps: [{ id: 'step-quality-1', title: 'Stock reservation vs fulfillment', description: 'Understand when reserveStock, fulfillReservation, and releaseReservation are called.', relatedFileIds: ['file-inventory-service', 'file-payment-service'], estimatedMinutes: 14 }] },
  { id: 'quest-impact', title: 'Predict change impact', description: 'Assess what breaks when you modify InventoryService.', type: 'change-impact', difficulty: 'intermediate', status: 'locked', estimatedMinutes: 16, objectiveIds: ['objective-quality'], prerequisites: ['quest-flow'], steps: [{ id: 'step-impact-1', title: 'Map the ripple', description: 'List every service and test that would be affected by a change to InventoryService.', relatedFileIds: ['file-inventory-service', 'file-order-test'], estimatedMinutes: 16 }] },
  { id: 'quest-contribution', title: 'Prepare a contribution', description: 'Plan an extension to the order refund flow.', type: 'contribution', difficulty: 'intermediate', status: 'locked', estimatedMinutes: 20, objectiveIds: ['objective-quality'], prerequisites: ['quest-impact'], steps: [{ id: 'step-contribution-1', title: 'Plan the refund extension', description: 'Identify files, components, and tests for adding partial refund support.', estimatedMinutes: 20 }] },
  { id: 'quest-ready', title: 'Contribution ready', description: 'Review what you learned and choose your next path.', type: 'completion', difficulty: 'introductory', status: 'locked', estimatedMinutes: 5, objectiveIds: [], prerequisites: ['quest-contribution'], steps: [{ id: 'step-ready-1', title: 'Reflect and continue', description: 'Capture remaining questions for future exploration.', estimatedMinutes: 5 }] },
]

const quizQuestions: QuizQuestion[] = [{ id: 'quiz-layers', prompt: 'In shopstack-api, which layer is responsible for business rules like stock reservation?', type: 'single-choice', answers: [{ id: 'answer-service', text: 'Services (e.g. OrderService, InventoryService)' }, { id: 'answer-controller', text: 'Controllers' }, { id: 'answer-repo', text: 'Repositories' }], correctAnswerIds: ['answer-service'], explanation: 'Services contain business logic. Controllers handle HTTP. Repositories talk to the DB.', objectiveIds: ['objective-map'] }]
const investigations: InvestigationScenario[] = [{ id: 'investigation-request', title: 'Order creation path', prompt: 'Starting at POST /api/orders, trace every class that handles the request before data is persisted.', context: 'Use the route wiring in src/routes/index.ts as your starting point.', expectedFindings: ['OrderController.create', 'OrderService.createOrder', 'InventoryService.reserveStock', 'OrderRepository.create'], hint: 'Look at constructor injection in createRouter() to understand which service each controller receives.', relatedFileIds: ['file-routes', 'file-order-service', 'file-inventory-service'], objectiveIds: ['objective-flow'] }]
const impactScenarios: ChangeImpactScenario[] = [{ id: 'impact-boundary', title: 'Change InventoryService.reserveStock signature', changeDescription: 'Add a maxRetries parameter to reserveStock().', affectedComponentIds: [], affectedFileIds: ['file-inventory-service', 'file-order-service', 'file-order-test'], risks: ['OrderService.createOrder calls reserveStock — must be updated', 'All unit tests that call reserveStock will need updating', 'PaymentService indirectly depends on reservation state'], validationSteps: ['Update OrderService', 'Run: npm test', 'Check tests/unit/orderService.test.ts passes'], objectiveIds: ['objective-quality'] }]
const contributionTasks: ContributionTask[] = [{ id: 'contribution-docs', title: 'Add partial refund support', description: 'PaymentService currently only supports full refunds. Plan a change to support partial refund amounts.', acceptanceCriteria: ['Accepts a partial amount parameter', 'Validates amount ≤ original payment', 'Updates order status correctly', 'Triggers a refund notification'], suggestedFileIds: ['file-payment-service', 'file-types', 'file-order-test'], relatedObjectiveIds: ['objective-quality'], difficulty: 'intermediate', status: 'not-started' }]
const gaps: KnowledgeGap[] = [{ id: 'gap-inventory', topic: 'Stock reservation lifecycle', description: 'Review when reserveStock, fulfillReservation, and releaseReservation are called relative to order and payment status.', objectiveIds: ['objective-quality'], sourceQuestIds: ['quest-flow'], severity: 'low', recommendedQuestIds: ['quest-quality'] }]
const path: OnboardingPath = { id: 'path-default', title: 'ShopStack API onboarding', description: 'From first look to first contribution in the shopstack-api codebase.', objectiveIds: objectives.map((o) => o.id), questIds: quests.map((q) => q.id), estimatedMinutes: 85, version: 1 }

export const demoRepository: Repository = { id: 'demo-repository', name: 'shopstack-api', source: 'local', status: 'ready', defaultBranch: 'main', analysisId: 'demo-analysis', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
export const demoAnalysis: RepositoryAnalysis = { id: 'demo-analysis', repositoryId: demoRepository.id, version: 1, generatedAt: '2026-01-01T00:00:00.000Z', projectSummary: { name: 'shopstack-api', description: 'A simple e-commerce backend API built with Node.js, TypeScript, Express, and SQLite.', purpose: 'Serve as the backend API for the ShopStack e-commerce platform.', projectType: 'REST API', maturity: 'Early-stage', technologies: ['Node.js', 'TypeScript', 'Express', 'SQLite', 'Jest'], domains: ['E-commerce', 'Payments', 'Inventory'] }, technologies: ['Node.js', 'TypeScript', 'Express', 'SQLite', 'Jest', 'better-sqlite3'], architecture: [{ id: 'component-controllers', name: 'Controllers', type: 'entry-point', description: 'Handle HTTP requests and responses. No business logic.', responsibilities: ['Parse HTTP request body and params', 'Call the appropriate service', 'Return success or error JSON'], fileIds: ['file-routes'] }, { id: 'component-services', name: 'Services', type: 'business-logic', description: 'Contain all business logic. Coordinate between repositories and other services.', responsibilities: ['Enforce business rules (e.g. stock reservation, order status transitions)', 'Orchestrate multi-step operations across repositories', 'Trigger side effects like notifications'], fileIds: ['file-order-service', 'file-payment-service', 'file-inventory-service'], dependsOnComponentIds: ['component-repositories'] }, { id: 'component-repositories', name: 'Repositories', type: 'data-access', description: 'Talk to the SQLite database. Each repository roughly owns one table.', responsibilities: ['Execute SQL queries via better-sqlite3', 'Map database rows to domain types', 'Own CRUD operations for their entity'], fileIds: ['file-schema'] }, { id: 'component-database', name: 'SQLite Database', type: 'database', description: 'Persistent storage. Schema defined in database/schema.sql.', responsibilities: ['Persist users, products, orders, payments, notifications'], fileIds: ['file-schema'] }], importantFiles: repositoryFiles.filter((f) => f.isEntryPoint || f.isDocumentation || f.id === 'file-order-service' || f.id === 'file-inventory-service' || f.id === 'file-schema'), files: repositoryFiles, dependencies: [{ id: 'dep-express', name: 'express', version: '^4.18.2', ecosystem: 'npm', category: 'framework', purpose: 'HTTP server and routing framework' }, { id: 'dep-sqlite', name: 'better-sqlite3', version: '^11.0.0', ecosystem: 'npm', category: 'database', purpose: 'Synchronous SQLite bindings for Node.js' }, { id: 'dep-uuid', name: 'uuid', version: '^9.0.0', ecosystem: 'npm', category: 'utility', purpose: 'Generate UUIDs for entity IDs' }, { id: 'dep-jest', name: 'jest', version: '^29.7.0', ecosystem: 'npm', category: 'testing', purpose: 'Unit and integration test runner', isDevelopmentOnly: true }], businessRules: [{ id: 'rule-stock-reservation', title: 'Stock is reserved at order creation', description: 'When an order is created, inventory is reserved (not deducted) so the same stock cannot be double-sold. Deduction happens only after successful payment.', sourceFileIds: ['file-order-service', 'file-inventory-service'] }, { id: 'rule-no-cancel-shipped', title: 'Shipped orders cannot be cancelled', description: 'Orders in "shipped", "completed", or "refunded" status cannot be cancelled.', sourceFileIds: ['file-order-service'] }, { id: 'rule-payment-state', title: 'Payment only accepted in pending/confirmed status', description: 'A payment attempt is rejected if the order is not in "pending" or "confirmed" status.', sourceFileIds: ['file-payment-service'] }], keyConcepts: [{ id: 'concept-reservation', name: 'Stock reservation vs fulfillment', description: 'InventoryService separates reservation (at order time) from fulfillment (at payment time). This prevents overselling while keeping stock available for cancellations.', relatedComponentIds: ['component-services'] }, { id: 'concept-injection', name: 'Constructor injection', description: 'All services and repositories are instantiated in createRouter() and passed via constructor. This makes testing easy and keeps dependencies explicit.', relatedFileIds: ['file-routes'] }, { id: 'concept-order-status', name: 'Order status state machine', description: 'Orders flow through: pending → confirmed → paid → shipped → completed. They can also become cancelled or payment_failed. Business rules govern which transitions are allowed.', relatedComponentIds: ['component-services'] }], testing: { frameworks: ['Jest', 'ts-jest'], testLocations: ['tests/unit'], commands: ['npm test', 'npm run test:unit'], conventions: ['Test files named *.test.ts', 'Tests in tests/unit/ mirror the src/ structure', 'Each test bootstraps an in-memory SQLite DB via createTestDatabase()'] }, documentation: { fileIds: ['file-readme', 'file-arch-doc'], guides: ['Setup guide', 'API overview', 'Architecture overview'] }, learningObjectives: objectives, quests, onboardingPath: path }

export const demoProgress: UserProgress = { userId: 'demo-user', repositoryId: demoRepository.id, currentQuestId: 'quest-map', completedQuestIds: [], questResults: [], knowledgeGaps: gaps, completedObjectiveIds: [], completionPercent: 0, startedAt: '2026-01-01T00:00:00.000Z' }
export const demoRepositoryInput: RepositoryInput = { kind: 'demo', name: 'shopstack-api', files: repositoryFiles, metadata: { mode: 'demo', analysisId: demoAnalysis.id } }
export const demoRepositoryService = new BrowserRepositoryService(() => Promise.resolve(demoRepositoryInput))

export interface DemoData {
  repository: Repository
  analysis: RepositoryAnalysis
  quizQuestions: QuizQuestion[]
  investigationScenarios: InvestigationScenario[]
  changeImpactScenarios: ChangeImpactScenario[]
  contributionTasks: ContributionTask[]
  progress: UserProgress
}

export const demoData: DemoData = { repository: demoRepository, analysis: demoAnalysis, quizQuestions, investigationScenarios: investigations, changeImpactScenarios: impactScenarios, contributionTasks, progress: demoProgress }
