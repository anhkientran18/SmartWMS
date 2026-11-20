import { httpClient } from '../api/httpClient';
import { ApiError } from '../api/apiTypes';

export type VelocityClass = 'Fast' | 'Medium' | 'Slow';

export interface SlottingRecommendation {
  sku: string;
  productName: string;
  currentZone: string;
  suggestedZone: string;
  velocityClass: VelocityClass;
  aiReasoning: string;
}

export interface SlottingRecommendationResponse {
  isSuccess: boolean;
  message?: string;
  data: SlottingRecommendation[];
}

export type SlottingErrorKind =
  | 'validation'
  | 'scope_unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_response'
  | 'provider_unavailable'
  | 'timeout'
  | 'unknown';

export interface SlottingError {
  status?: number;
  code?: string;
  kind: SlottingErrorKind;
  message: string;
}

export function parseSlottingError(err: unknown): SlottingError {
  if (err && typeof err === 'object' && 'kind' in err) {
    return err as SlottingError;
  }

  const apiErr = err as Partial<ApiError>;
  const status = apiErr?.status;
  const code = apiErr?.code;

  if (status === 400) {
    return {
      status: 400,
      code: code || 'SCOPE_UNAVAILABLE',
      kind: 'scope_unavailable',
      message:
        'Recommendations could not be generated for the selected scope. The zone may no longer be available or there may be insufficient outbound history.',
    };
  }

  if (status === 401) {
    return {
      status: 401,
      code: 'UNAUTHORIZED',
      kind: 'unauthorized',
      message: 'Authentication session expired. Please sign in again.',
    };
  }

  if (status === 403) {
    return {
      status: 403,
      code: 'FORBIDDEN',
      kind: 'forbidden',
      message: 'You do not have permission to view AI slotting recommendations.',
    };
  }

  if (status === 502 || code === 'AI_RESPONSE_INVALID') {
    return {
      status: 502,
      code: 'AI_RESPONSE_INVALID',
      kind: 'invalid_response',
      message: 'The AI slotting recommendation response could not be processed.',
    };
  }

  if (status === 503 || code === 'AI_CONFIGURATION_MISSING' || code === 'AI_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      code,
      kind: 'provider_unavailable',
      message: 'AI slotting service is currently unavailable. Inventory operations remain unaffected.',
    };
  }

  if (status === 504 || code === 'AI_TIMEOUT') {
    return {
      status: 504,
      code,
      kind: 'timeout',
      message: 'AI slotting request timed out.',
    };
  }

  return {
    status,
    code,
    kind: 'unknown',
    message: 'AI slotting recommendations are unavailable. Core inventory operations remain unaffected.',
  };
}

export async function getSlottingRecommendations(
  zoneId?: string | null,
  signal?: AbortSignal
): Promise<SlottingRecommendation[]> {
  const url =
    zoneId && zoneId.trim()
      ? `/api/v1/Dashboard/ai-slotting-recommendations?zoneId=${encodeURIComponent(zoneId.trim())}`
      : '/api/v1/Dashboard/ai-slotting-recommendations';

  try {
    const response = await httpClient.get<SlottingRecommendationResponse>(url, { signal });
    const payload = response.data;

    if (!payload || payload.isSuccess !== true || !Array.isArray(payload.data)) {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Invalid slotting recommendation payload received from server.',
      } as SlottingError;
    }

    if (payload.data.length === 0) {
      return [];
    }

    const seenSkus = new Set<string>();
    const validatedRecommendations: SlottingRecommendation[] = [];

    for (const item of payload.data) {
      if (!item || typeof item !== 'object') {
        throw {
          status: 502,
          code: 'AI_RESPONSE_INVALID',
          kind: 'invalid_response',
          message: 'Malformed slotting item in response.',
        } as SlottingError;
      }

      const { sku, productName, currentZone, suggestedZone, velocityClass, aiReasoning } = item;

      if (
        typeof sku !== 'string' ||
        !sku.trim() ||
        typeof productName !== 'string' ||
        !productName.trim() ||
        typeof currentZone !== 'string' ||
        !currentZone.trim() ||
        typeof suggestedZone !== 'string' ||
        !suggestedZone.trim() ||
        (velocityClass !== 'Fast' && velocityClass !== 'Medium' && velocityClass !== 'Slow') ||
        typeof aiReasoning !== 'string' ||
        !aiReasoning.trim()
      ) {
        throw {
          status: 502,
          code: 'AI_RESPONSE_INVALID',
          kind: 'invalid_response',
          message: 'Malformed fields or invalid velocity class in slotting recommendation item.',
        } as SlottingError;
      }

      const cleanSku = sku.trim();
      if (seenSkus.has(cleanSku)) {
        throw {
          status: 502,
          code: 'AI_RESPONSE_INVALID',
          kind: 'invalid_response',
          message: `Duplicate recommendation returned for SKU: ${cleanSku}.`,
        } as SlottingError;
      }
      seenSkus.add(cleanSku);

      validatedRecommendations.push({
        sku: cleanSku,
        productName: productName.trim(),
        currentZone: currentZone.trim(),
        suggestedZone: suggestedZone.trim(),
        velocityClass,
        aiReasoning: aiReasoning.trim(),
      });
    }

    return validatedRecommendations;
  } catch (err: unknown) {
    if ((err as SlottingError)?.kind) {
      throw err;
    }
    throw parseSlottingError(err);
  }
}
