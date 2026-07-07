import { config } from '../config';
import { AnalyticsSummary } from './analyticsClient';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `Eres un analista de datos para una plataforma de empleo y bolsa de trabajo
universitaria (UCE Alumni & Employment Platform). Recibes métricas agregadas en JSON
(usuarios, vacantes, matches, perfiles) y debes producir un resumen ejecutivo breve
en español, orientado a un administrador no técnico. Estructura la respuesta así:

1. Un párrafo de resumen ejecutivo (2-3 frases).
2. 3 a 5 hallazgos concretos como viñetas, cada uno anclado en un número real de las métricas.

No inventes cifras que no estén en el JSON. No agregues secciones adicionales.`;

export interface InsightsResult {
  summary: string;
  generatedAt: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Llama al endpoint REST de Gemini (Google AI Studio, capa gratuita).
 * Se usa fetch directo en vez de un SDK para no agregar una dependencia
 * nueva — el patrón es el mismo que analyticsClient.ts.
 */
export async function generateInsights(metrics: AnalyticsSummary): Promise<InsightsResult> {
  const url = `${GEMINI_ENDPOINT}/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `Métricas actuales:\n\n${JSON.stringify(metrics, null, 2)}` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new LlmGenerationError(`Gemini API respondió ${response.status}: ${body}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new LlmGenerationError('Gemini no devolvió contenido de texto');
  }

  return {
    summary: text,
    generatedAt: new Date().toISOString(),
  };
}

export class LlmGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmGenerationError';
  }
}
