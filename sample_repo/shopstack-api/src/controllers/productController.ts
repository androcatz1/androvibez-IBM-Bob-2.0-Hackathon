import { Request, Response } from 'express';
import { ProductRepository } from '../repositories/productRepository';

export class ProductController {
  constructor(private productRepo: ProductRepository) {}

  list = (_req: Request, res: Response): void => {
    const products = this.productRepo.findAll();
    res.json({ success: true, data: products });
  };

  getById = (req: Request, res: Response): void => {
    const product = this.productRepo.findById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, data: product });
  };

  create = (req: Request, res: Response): void => {
    try {
      const product = this.productRepo.create(req.body);
      res.status(201).json({ success: true, data: product });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  updateStock = (req: Request, res: Response): void => {
    try {
      const { quantity } = req.body as { quantity: number };
      this.productRepo.updateStock(req.params.id, quantity);
      const product = this.productRepo.findById(req.params.id);
      res.json({ success: true, data: product });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };
}
