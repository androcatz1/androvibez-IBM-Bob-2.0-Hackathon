import { ProductRepository } from '../repositories/productRepository';

export class InventoryService {
  constructor(private productRepo: ProductRepository) {}

  /**
   * Check if the requested quantity is available for a product.
   * Available = stock_quantity - reserved_quantity
   */
  isAvailable(productId: string, quantity: number): boolean {
    const available = this.productRepo.getAvailableQuantity(productId);
    return available >= quantity;
  }

  /**
   * Reserve stock for an order. This does NOT deduct from actual stock —
   * it only marks units as reserved so they can't be double-sold.
   * Called during order creation, before payment.
   */
  reserveStock(productId: string, quantity: number): void {
    if (!this.isAvailable(productId, quantity)) {
      throw new Error(`Insufficient stock for product ${productId}`);
    }
    this.productRepo.reserveStock(productId, quantity);
  }

  /**
   * Release a reservation without fulfilling it.
   * Called when payment fails or an order is cancelled before payment.
   */
  releaseReservation(productId: string, quantity: number): void {
    this.productRepo.releaseReservation(productId, quantity);
  }

  /**
   * Fulfill the reservation — deduct from actual stock.
   * Called after a successful payment.
   */
  fulfillReservation(productId: string, quantity: number): void {
    this.productRepo.deductStock(productId, quantity);
  }

  /**
   * Return stock after a refund.
   * TODO: decide whether to restore reserved_quantity or stock_quantity directly.
   * Currently restores stock_quantity only (does not re-reserve).
   */
  returnStock(productId: string, quantity: number): void {
    const product = this.productRepo.findById(productId);
    if (!product) throw new Error(`Product ${productId} not found`);
    this.productRepo.updateStock(productId, product.stock_quantity + quantity);
  }
}
