import { Router, Request, Response } from 'express';
import { requireAdmin, AuthRequest } from '@uce-platform/auth-shared';
import { fetchAnalyticsSummary, AnalyticsServiceError } from '../services/analyticsClient';
import { generateInsights, LlmGenerationError } from '../services/llmClient';
import { getCached, setCached } from '../services/cache';

export const insightsRouter = Router();

const CACHE_KEY = 'insights:summary';

insightsRouter.get('/summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const cached = await getCached(CACHE_KEY);
    if (cached) {
      res.json({ ...JSON.parse(cached), cached: true });
      return;
    }

    const authorizationHeader = req.headers.authorization as string;
    const metrics = await fetchAnalyticsSummary(authorizationHeader);
    const insights = await generateInsights(metrics);

    await setCached(CACHE_KEY, JSON.stringify(insights));

    res.json({ ...insights, cached: false });
  } catch (err) {
    if (err instanceof AnalyticsServiceError) {
      res.status(502).json({ error: 'No se pudo obtener métricas de analytics-service', detail: err.message });
      return;
    }
    if (err instanceof LlmGenerationError) {
      res.status(502).json({ error: 'No se pudo generar el resumen con el LLM', detail: err.message });
      return;
    }
    console.error('[insights-service] Error inesperado', err);
    res.status(500).json({ error: 'Error interno de insights-service' });
  }
});
