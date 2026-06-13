import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || '';
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || '';
const JWT_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

export class AuthController {
  githubLogin = (req: Request, res: Response): void => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=user:email`;
    res.redirect(githubAuthUrl);
  };

  githubCallback = async (req: Request, res: Response): Promise<void> => {
    const { code } = req.query;

    if (!code) {
      res.status(400).json({ error: 'No code provided' });
      return;
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
        { headers: { Accept: 'application/json' } },
      );

      const githubAccessToken = tokenResponse.data.access_token;

      // Get user info from GitHub
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${githubAccessToken}` },
      });

      const githubUser = userResponse.data;

      const role = 'student'; // default, admin-service'll change it later

      const payload = {
        id: githubUser.id,
        username: githubUser.login,
        name: githubUser.name,
        avatar: githubUser.avatar_url,
        provider: 'github',
        role, // ← NUEVO
      };
      // Issue JWT access token (15min)
      const accessToken = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      // Issue refresh token (7d)
      const refreshToken = jwt.sign({ id: githubUser.id, role }, JWT_SECRET, {
        expiresIn: REFRESH_EXPIRES_IN,
      });

      // Set refresh token as httpOnly cookie
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect to frontend with token

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
      res.redirect(
        `${frontendUrl}/auth/callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(payload))}`,
      );
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  refresh = (req: Request, res: Response): void => {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as { id: number; role: string };
      const accessToken = jwt.sign({ id: decoded.id, role: decoded.role ?? 'student'}, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });
      res.json({ accessToken });
    } catch {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  };

  logout = (req: Request, res: Response): void => {
    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out successfully' });
  };

  me = (req: Request, res: Response): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ user: decoded });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}
