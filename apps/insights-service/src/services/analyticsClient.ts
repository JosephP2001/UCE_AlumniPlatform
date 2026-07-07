import { config } from '../config';

export interface AnalyticsSummary {
  [metric: string]: unknown;
}

/**
 * Llama a GET /api/analytics/summary en analytics-service.
 * Reenvía el header Authorization del request original: analytics-service
 * también exige JWT de admin, así que insights-service no necesita un
 * secreto de servicio separado, solo pasar el token del usuario autenticado.
 */
export async function fetchAnalyticsSummary(authorizationHeader: string): Promise<AnalyticsSummary> {
  const url = `${config.analyticsServiceUrl}/api/analytics/summary`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authorizationHeader,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new AnalyticsServiceError(`analytics-service respondió ${response.status}`, response.status);
  }

  return (await response.json()) as AnalyticsSummary;
}

export class AnalyticsServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AnalyticsServiceError';
  }
}
