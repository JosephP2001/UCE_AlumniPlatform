import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtUser {
  id: number;
  username: string;
  name?: string;
  avatar?: string;
  provider?: string;
  role?: string;
}

export interface AuthRequest extends Request {
  user?: JwtUser;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
}

/** Verifica el Bearer token y adjunta el usuario decodificado a req.user. No exige rol. */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getSecret()) as JwtUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Igual que requireAuth, pero además exige role === 'admin'. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden — admin role required' });
      return;
    }
    next();
  });
}

export function signAccessToken(payload: JwtUser, expiresIn: SignOptions['expiresIn'] = '15m'): string {
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function signRefreshToken(payload: { id: number; role?: string }, expiresIn: SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, getSecret(), { expiresIn });
}