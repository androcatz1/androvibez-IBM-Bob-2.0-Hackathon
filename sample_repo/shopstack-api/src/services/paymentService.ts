import { PaymentRepository } from '../repositories/paymentRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { InventoryService } from './inventoryService';
import { NotificationService } from './notificationService';
import { UserRepository } from '../repositories/userRepository';
import { Payment, ProcessPaymentInput } from '../models/types';

export class PaymentService {
  constructor(
    private paymentRepo: PaymentRepository,
    private orderRepo: OrderRepository,
    private userRepo: UserRepository,
    private inventoryService: InventoryService,
    private notificationService: NotificationService
  ) {}

  async processPayment(input: ProcessPaymentInput): Promise<Payment> {
    const order = this.orderRepo.findById(input.order_id);
    if (!order) throw new Error(`Order ${input.order_id} not found`);
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      throw new Error(`Order is not in a payable state (current: ${order.status})`);
    }

    const existing = this.paymentRepo.findByOrderId(input.order_id);
    if (existing && existing.status === 'completed') {
      throw new Error('Order has already been paid');
    }

    const payment = this.paymentRepo.create(order.id, order.total_amount, input.method);

    // Simulate payment processing — in production this calls a payment gateway
    const success = this.simulatePaymentGateway(order.total_amount);

    if (success) {
      this.paymentRepo.updateStatus(payment.id, 'completed');
      this.orderRepo.updateStatus(order.id, 'paid');

      // Deduct reserved stock now that payment is confirmed
      for (const item of order.items ?? []) {
        this.inventoryService.fulfillReservation(item.product_id, item.quantity);
      }

      const user = this.userRepo.findById(order.user_id);
      if (user) {
        this.notificationService.sendOrderConfirmation(user.id, order);
      }

      return this.paymentRepo.findById(payment.id)!;
    } else {
      const reason = 'Payment declined by gateway';
      this.paymentRepo.updateStatus(payment.id, 'failed', reason);
      this.orderRepo.updateStatus(order.id, 'payment_failed');

      // Release inventory so other customers can buy
      for (const item of order.items ?? []) {
        this.inventoryService.releaseReservation(item.product_id, item.quantity);
      }

      const user = this.userRepo.findById(order.user_id);
      if (user) {
        this.notificationService.sendPaymentFailure(user.id, order, reason);
      }

      return this.paymentRepo.findById(payment.id)!;
    }
  }

  async refundPayment(orderId: string): Promise<Payment> {
    const payment = this.paymentRepo.findByOrderId(orderId);
    if (!payment) throw new Error(`No payment found for order ${orderId}`);
    if (payment.status !== 'completed') {
      throw new Error(`Only completed payments can be refunded (current: ${payment.status})`);
    }

    this.paymentRepo.updateStatus(payment.id, 'refunded');
    this.orderRepo.updateStatus(orderId, 'refunded');

    const order = this.orderRepo.findById(orderId)!;
    for (const item of order.items ?? []) {
      this.inventoryService.returnStock(item.product_id, item.quantity);
    }

    const user = this.userRepo.findById(order.user_id);
    if (user) {
      this.notificationService.sendRefundIssued(user.id, order, payment.amount);
    }

    return this.paymentRepo.findById(payment.id)!;
  }

  getPaymentStatus(orderId: string): Payment {
    const payment = this.paymentRepo.findByOrderId(orderId);
    if (!payment) throw new Error(`No payment found for order ${orderId}`);
    return payment;
  }

  // Simulates a payment gateway. Fails ~20% of the time.
  // TODO: replace with real gateway integration
  private simulatePaymentGateway(amount: number): boolean {
    // amounts ending in .99 always fail — useful for testing failure paths
    if (Math.round(amount * 100) % 100 === 99) return false;
    return Math.random() > 0.2;
  }
}
