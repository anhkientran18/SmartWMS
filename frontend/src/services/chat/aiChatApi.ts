import { httpClient } from '../api/httpClient';
import { Result, ApiError } from '../api/apiTypes';

export interface AiChatRequestPayload {
  message: string;
}

export type AiChatErrorKind = 'validation' | 'provider_unavailable' | 'invalid_response' | 'timeout' | 'unknown';

export interface AiChatError {
  status?: number;
  code?: string;
  kind: AiChatErrorKind;
  message: string;
}

export function parseAiChatError(err: unknown): AiChatError {
  const apiErr = err as Partial<ApiError>;
  const status = apiErr?.status;
  const code = apiErr?.code;

  if (status === 400 || code === 'VALIDATION_ERROR') {
    return {
      status: 400,
      code,
      kind: 'validation',
      message: apiErr?.message || 'Invalid chat message.',
    };
  }

  if (status === 503 || code === 'AI_CONFIGURATION_MISSING' || code === 'AI_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      code,
      kind: 'provider_unavailable',
      message: 'AI guidance is currently unavailable. SmartWMS operational functions remain available.',
    };
  }

  if (status === 502 || code === 'AI_RESPONSE_INVALID') {
    return {
      status: 502,
      code,
      kind: 'invalid_response',
      message: 'The AI response could not be processed. Please try again.',
    };
  }

  if (status === 504 || code === 'AI_TIMEOUT') {
    return {
      status: 504,
      code,
      kind: 'timeout',
      message: 'The AI request timed out. Please try again.',
    };
  }

  return {
    status,
    code,
    kind: 'unknown',
    message: 'Unable to communicate with AI service. Please try again later.',
  };
}

export async function askAiGuidance(message: string, signal?: AbortSignal): Promise<string> {
  const trimmed = message.trim();

  if (!trimmed) {
    throw {
      status: 400,
      code: 'VALIDATION_EMPTY',
      kind: 'validation',
      message: 'Message cannot be empty.',
    } as AiChatError;
  }

  if (trimmed.length > 2000) {
    throw {
      status: 400,
      code: 'VALIDATION_TOO_LONG',
      kind: 'validation',
      message: 'Message cannot exceed 2000 characters.',
    } as AiChatError;
  }

  try {
    const response = await httpClient.post<Result<string>>(
      '/api/v1/Chat/ask',
      { message: trimmed } satisfies AiChatRequestPayload,
      { signal }
    );

    const payload = response.data;
    if (!payload || payload.isSuccess !== true || typeof payload.data !== 'string') {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Invalid AI response payload received from server.',
      } as AiChatError;
    }

    return payload.data;
  } catch (err: unknown) {
    if ((err as AiChatError)?.kind) {
      throw err;
    }
    throw parseAiChatError(err);
  }
}
