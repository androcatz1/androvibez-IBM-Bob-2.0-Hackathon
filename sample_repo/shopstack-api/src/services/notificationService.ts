import { NotificationRepository } from '../repositories/notificationRepository';
import { NotificationType, Order, Payment } from '../models/types';

export class NotificationService {
  constructor(private notificationRepo: NotificationRepository) {}

  sendOrderConfirmation(userId: string, order: Order): void {
    const message = `Your order #${order.id.slice(0, 8)} has been confirmed. Total: $${order.total_amount.toFixed(2)}`;
    this.notificationRepo.create(userId, 'order_confirmed', message);
  }

  sendPaymentFailure(userId: string, order: Order, reason?: string): void {
    const message = `Payment failed for order #${order.id.slice(0, 8)}. ${reason ?? 'Please update your payment details.'}`;
    this.notificationRepo.create(userId, 'payment_failed', message);
  }

  sendOrderShipped(userId: string, order: Order): void {
    const message = `Your order #${order.id.slice(0, 8)} has been shipped and is on its way!`;
    this.notificationRepo.create(userId, 'order_shipped', message);
  }

  sendRefundIssued(userId: string, order: Order, amount: number): void {
    const message = `A refund of $${amount.toFixed(2)} has been issued for order #${order.id.slice(0, 8)}.`;
    this.notificationRepo.create(userId, 'refund_issued', message);
  }

  sendOrderCancelled(userId: string, order: Order): void {
    const message = `Your order #${order.id.slice(0, 8)} has been cancelled.`;
    this.notificationRepo.create(userId, 'order_cancelled', message);
  }

  // Generic send for custom notification types
  send(userId: string, type: NotificationType, message: string): void {
    this.notificationRepo.create(userId, type, message);
  }
}
