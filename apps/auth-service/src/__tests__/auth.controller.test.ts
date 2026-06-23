import { Request, Response } from 'express';
import { AuthController } from '../controllers/auth.controller';
import axios from 'axios';
import jwt from 'jsonwebtoken';

jest.mock('axios');
jest.mock('jsonwebtoken');

const mockReq = (options: Partial<Request> = {}) => ({
  query: {},
  cookies: {},
  headers: {},
  ...options
} as unknown as Request);

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController();
    jest.clearAllMocks();
  });

  describe('githubLogin', () => {
    it('should redirect to GitHub OAuth URL', () => {
      const req = mockReq();
      const res = mockRes();
      controller.githubLogin(req, res);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/login/oauth/authorize')
      );
    });
  });

  describe('githubCallback', () => {
    it('should return 400 if no code provided', async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();
      await controller.githubCallback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should redirect with access token on valid code', async () => {
      const mockGithubUser = {
        id: 123, login: 'testuser', name: 'Test User',
        avatar_url: 'https://avatar.url'
      };
      (axios.post as jest.Mock).mockResolvedValue({
        data: { access_token: 'github-token' }
      });
      (axios.get as jest.Mock).mockResolvedValue({ data: mockGithubUser });
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const req = mockReq({ query: { code: 'valid-code' } });
      const res = mockRes();
      await controller.githubCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('token=mock-jwt-token')
      );
    });
  });

  describe('refresh', () => {
    it('should return 401 if no refresh token', () => {
      const req = mockReq({ cookies: {} });
      const res = mockRes();
      controller.refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return new access token on valid refresh token', () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 123 });
      (jwt.sign as jest.Mock).mockReturnValue('new-access-token');

      const req = mockReq({ cookies: { refresh_token: 'valid-refresh' } });
      const res = mockRes();
      controller.refresh(req, res);

      expect(res.json).toHaveBeenCalledWith({ accessToken: 'new-access-token' });
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success message', () => {
      const req = mockReq();
      const res = mockRes();
      controller.logout(req, res);
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });

  describe('me', () => {
    it('should return 401 if no Bearer token', () => {
      const req = mockReq({ headers: {} });
      const res = mockRes();
      controller.me(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return user data on valid token', () => {
      const mockUser = { id: 123, username: 'testuser' };
      (jwt.verify as jest.Mock).mockReturnValue(mockUser);

      const req = mockReq({
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = mockRes();
      controller.me(req, res);

      expect(res.json).toHaveBeenCalledWith({ user: mockUser });
    });
  });
});