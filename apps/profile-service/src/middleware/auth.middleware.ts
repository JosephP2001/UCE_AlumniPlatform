import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../logger';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    provider: string;
  };
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthRequest['user'];
    req.user = payload;
    logger.info('Auth middleware passed', { userId: payload?.id });
    next();
  } catch {
    logger.warn('Auth middleware rejected token');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
