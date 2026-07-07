process.env.GEMINI_API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ANALYTICS_SERVICE_URL = 'http://analytics-service:3007';

import request from 'supertest';
import { signAccessToken } from '@uce-platform/auth-shared';

jest.mock('../src/services/cache', () => ({
  getCached: jest.fn(),
  setCached: jest.fn(),
  closeCache: jest.fn(),
}));

jest.mock('../src/services/analyticsClient', () => {
  const actual = jest.requireActual('../src/services/analyticsClient');
  return {
    ...actual,
    fetchAnalyticsSummary: jest.fn(),
  };
});

jest.mock('../src/services/llmClient', () => {
  const actual = jest.requireActual('../src/services/llmClient');
  return {
    ...actual,
    generateInsights: jest.fn(),
  };
});

import { app } from '../src/index';
import { getCached, setCached } from '../src/services/cache';
import { fetchAnalyticsSummary, AnalyticsServiceError } from '../src/services/analyticsClient';
import { generateInsights, LlmGenerationError } from '../src/services/llmClient';

const AUTH_HEADER = `Bearer ${signAccessToken({ id: 1, username: 'admin-test', role: 'admin' })}`;

describe('GET /api/insights/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve 401 sin header Authorization', async () => {
    const res = await request(app).get('/api/insights/summary');
    expect(res.status).toBe(401);
  });

  it('devuelve el resumen cacheado sin llamar a analytics ni al LLM', async () => {
    const cachedPayload = { summary: 'Resumen cacheado', generatedAt: '2026-07-06T00:00:00.000Z' };
    (getCached as jest.Mock).mockResolvedValue(JSON.stringify(cachedPayload));

    const res = await request(app)
      .get('/api/insights/summary')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.summary).toBe('Resumen cacheado');
    expect(fetchAnalyticsSummary).not.toHaveBeenCalled();
    expect(generateInsights).not.toHaveBeenCalled();
  });

  it('en cache miss: consulta analytics, genera insights y cachea el resultado', async () => {
    (getCached as jest.Mock).mockResolvedValue(null);
    (fetchAnalyticsSummary as jest.Mock).mockResolvedValue({ totalUsers: 120, totalMatches: 34 });
    (generateInsights as jest.Mock).mockResolvedValue({
      summary: 'Resumen generado por el LLM',
      generatedAt: '2026-07-06T00:00:00.000Z',
    });

    const res = await request(app)
      .get('/api/insights/summary')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.summary).toBe('Resumen generado por el LLM');
    expect(fetchAnalyticsSummary).toHaveBeenCalledWith(AUTH_HEADER);
    expect(setCached).toHaveBeenCalledTimes(1);
  });

  it('devuelve 502 si analytics-service falla', async () => {
    (getCached as jest.Mock).mockResolvedValue(null);
    (fetchAnalyticsSummary as jest.Mock).mockRejectedValue(
      new AnalyticsServiceError('analytics-service respondió 500', 500)
    );

    const res = await request(app)
      .get('/api/insights/summary')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/analytics-service/);
    expect(generateInsights).not.toHaveBeenCalled();
    expect(setCached).not.toHaveBeenCalled();
  });

  it('devuelve 502 si el LLM falla', async () => {
    (getCached as jest.Mock).mockResolvedValue(null);
    (fetchAnalyticsSummary as jest.Mock).mockResolvedValue({ totalUsers: 120 });
    (generateInsights as jest.Mock).mockRejectedValue(new LlmGenerationError('timeout del LLM'));

    const res = await request(app)
      .get('/api/insights/summary')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/LLM/);
    expect(setCached).not.toHaveBeenCalled();
  });
});
