import { OrderRepository } from '../repositories/orderRepository';
import { ProductRepository } from '../repositories/productRepository';
import { InventoryService } from './inventoryService';
import { Order, CreateOrderInput, OrderStatus } from '../models/types';

// Orders cannot be cancelled once they reach these statuses
const NON_CANCELLABLE_STATUSES: OrderStatus[] = ['shipped', 'completed', 'refunded'];

export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private inventoryService: InventoryService
  ) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    // Validate products and calculate total
    const itemsWithPrice = [];
    let total = 0;

    for (const item of input.items) {
      const product = this.productRepo.findById(item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (!this.inventoryService.isAvailable(item.product_id, item.quantity)) {
        throw new Error(`Insufficient stock for "${product.name}"`);
      }
      itemsWithPrice.push({ ...item, unit_price: product.price });
      total += product.price * item.quantity;
    }

    // Reserve stock before creating the order
    for (const item of itemsWithPrice) {
      this.inventoryService.reserveStock(item.product_id, item.quantity);
    }

    const order = this.orderRepo.create(input.user_id, total, itemsWithPrice);
    return order;
  }

  getOrder(id: string): Order {
    const order = this.orderRepo.findById(id);
    if (!order) throw new Error(`Order ${id} not found`);
    return order;
  }

  getUserOrders(userId: string): Order[] {
    return this.orderRepo.findByUserId(userId);
  }

  updateStatus(id: string, status: OrderStatus): Order {
    const order = this.orderRepo.findById(id);
    if (!order) throw new Error(`Order ${id} not found`);

    if (status === 'cancelled') {
      if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
        throw new Error(`Order cannot be cancelled in status "${order.status}"`);
      }
      // Release inventory if cancelling before payment
      if (order.status === 'pending' || order.status === 'confirmed') {
        for (const item of order.items ?? []) {
          this.inventoryService.releaseReservation(item.product_id, item.quantity);
        }
      }
    }

    return this.orderRepo.updateStatus(id, status)!;
  }
}
