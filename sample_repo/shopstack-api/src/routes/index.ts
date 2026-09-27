import { Router } from 'express';
import Database from 'better-sqlite3';

import { UserRepository } from '../repositories/userRepository';
import { ProductRepository } from '../repositories/productRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { NotificationRepository } from '../repositories/notificationRepository';

import { InventoryService } from '../services/inventoryService';
import { NotificationService } from '../services/notificationService';
import { OrderService } from '../services/orderService';
import { PaymentService } from '../services/paymentService';

import { UserController } from '../controllers/userController';
import { ProductController } from '../controllers/productController';
import { OrderController } from '../controllers/orderController';

export function createRouter(db: Database.Database): Router {
  const router = Router();

  // Repositories
  const userRepo = new UserRepository(db);
  const productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);
  const paymentRepo = new PaymentRepository(db);
  const notificationRepo = new NotificationRepository(db);

  // Services
  const inventoryService = new InventoryService(productRepo);
  const notificationService = new NotificationService(notificationRepo);
  const orderService = new OrderService(orderRepo, productRepo, inventoryService);
  const paymentService = new PaymentService(paymentRepo, orderRepo, userRepo, inventoryService, notificationService);

  // Controllers
  const userController = new UserController(userRepo);
  const productController = new ProductController(productRepo);
  const orderController = new OrderController(orderService, paymentService);

  // User routes
  router.post('/users', userController.create);
  router.get('/users/:id', userController.getById);
  router.patch('/users/:id', userController.update);

  // Product routes
  router.get('/products', productController.list);
  router.get('/products/:id', productController.getById);
  router.post('/products', productController.create);
  router.patch('/products/:id/stock', productController.updateStock);

  // Order routes
  router.post('/orders', orderController.create);
  router.get('/orders/:id', orderController.getById);
  router.patch('/orders/:id/status', orderController.updateStatus);
  router.post('/orders/:id/pay', orderController.processPayment);
  router.post('/orders/:id/refund', orderController.refund);

  return router;
}
