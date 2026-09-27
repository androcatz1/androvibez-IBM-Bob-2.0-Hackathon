import { Request, Response } from 'express';
import { UserRepository } from '../repositories/userRepository';

export class UserController {
  constructor(private userRepo: UserRepository) {}

  create = (req: Request, res: Response): void => {
    try {
      const existing = this.userRepo.findByEmail(req.body.email);
      if (existing) {
        res.status(409).json({ success: false, error: 'Email already in use' });
        return;
      }
      const user = this.userRepo.create(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  getById = (req: Request, res: Response): void => {
    const user = this.userRepo.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  };

  update = (req: Request, res: Response): void => {
    try {
      const user = this.userRepo.update(req.params.id, req.body);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };
}
