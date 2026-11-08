import { isCancel } from 'axios';
import { httpClient } from '../api/httpClient';
import { Result, ApiError } from '../api/apiTypes';

export interface SemanticProductDto {
  id: string;
  sku: string;
  name: string;
  description: string;
  similarityScore: number;
}

export type SemanticSearchErrorKind = 'validation' | 'provider_unavailable' | 'invalid_response' | 'timeout' | 'unknown';

export interface SemanticSearchError {
  status?: number;
  code?: string;
  kind: SemanticSearchErrorKind;
  message: string;
}

export function parseSemanticSearchError(err: unknown): SemanticSearchError {
  const apiErr = err as Partial<ApiError>;
  const status = apiErr?.status;
  const code = apiErr?.code;

  if (status === 400 || code === 'VALIDATION_ERROR') {
    return {
      status: 400,
      code,
      kind: 'validation',
      message: apiErr?.message || 'Invalid search query.',
    };
  }

  if (status === 503 || code === 'AI_CONFIGURATION_MISSING' || code === 'AI_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      code,
      kind: 'provider_unavailable',
      message: 'Semantic AI search is currently unavailable. Standard product search remains available.',
    };
  }

  if (status === 502 || code === 'AI_RESPONSE_INVALID') {
    return {
      status: 502,
      code,
      kind: 'invalid_response',
      message: 'The AI embedding response could not be processed. Please try again.',
    };
  }

  if (status === 504 || code === 'AI_TIMEOUT') {
    return {
      status: 504,
      code,
      kind: 'timeout',
      message: 'Semantic search request timed out. Please try again.',
    };
  }

  return {
    status,
    code,
    kind: 'unknown',
    message: 'Semantic search failed. Standard product search remains available.',
  };
}

export async function searchSemanticProducts(query: string, signal?: AbortSignal): Promise<SemanticProductDto[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    throw {
      status: 400,
      code: 'VALIDATION_EMPTY',
      kind: 'validation',
      message: 'Search query cannot be empty.',
    } as SemanticSearchError;
  }

  if (trimmed.length > 200) {
    throw {
      status: 400,
      code: 'VALIDATION_TOO_LONG',
      kind: 'validation',
      message: 'Search query cannot exceed 200 characters.',
    } as SemanticSearchError;
  }

  try {
    const response = await httpClient.get<Result<SemanticProductDto[]>>(
      `/api/v1/Products/semantic-search?text=${encodeURIComponent(trimmed)}`,
      { signal }
    );

    const payload = response.data;
    if (!payload || payload.isSuccess !== true || !Array.isArray(payload.data)) {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Invalid semantic search payload received from server.',
      } as SemanticSearchError;
    }

    // Validate that each item has non-empty id, sku, name, and numeric similarityScore
    const validItems: SemanticProductDto[] = [];
    for (const item of payload.data) {
      if (
        item &&
        typeof item.id === 'string' &&
        item.id.trim() &&
        typeof item.sku === 'string' &&
        item.sku.trim() &&
        typeof item.name === 'string' &&
        item.name.trim() &&
        typeof item.similarityScore === 'number' &&
        Number.isFinite(item.similarityScore)
      ) {
        validItems.push({
          id: item.id.trim(),
          sku: item.sku.trim(),
          name: item.name.trim(),
          description: typeof item.description === 'string' ? item.description : '',
          similarityScore: item.similarityScore,
        });
      }
    }

    if (payload.data.length > 0 && validItems.length === 0) {
      throw { status: 502, code: 'AI_RESPONSE_INVALID', kind: 'invalid_response',
        message: 'No valid products in semantic search response.' } as SemanticSearchError;
    }
    return validItems;
  } catch (err: unknown) {
    if (isCancel(err)) throw err;
    if ((err as SemanticSearchError)?.kind) {
      throw err;
    }
    throw parseSemanticSearchError(err);
  }
}
