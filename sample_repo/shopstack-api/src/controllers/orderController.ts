import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { PaymentService } from '../services/paymentService';
import { OrderStatus } from '../models/types';

export class OrderController {
  constructor(
    private orderService: OrderService,
    private paymentService: PaymentService
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const order = await this.orderService.createOrder(req.body);
      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  getById = (req: Request, res: Response): void => {
    try {
      const order = this.orderService.getOrder(req.params.id);
      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  };

  updateStatus = (req: Request, res: Response): void => {
    try {
      const { status } = req.body as { status: OrderStatus };
      const order = this.orderService.updateStatus(req.params.id, status);
      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  processPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const payment = await this.paymentService.processPayment({
        order_id: req.params.id,
        method: req.body.method ?? 'card',
      });
      res.json({ success: true, data: payment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  refund = async (req: Request, res: Response): Promise<void> => {
    try {
      const payment = await this.paymentService.refundPayment(req.params.id);
      res.json({ success: true, data: payment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };
}
