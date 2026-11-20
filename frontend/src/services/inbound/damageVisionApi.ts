import { httpClient } from '../api/httpClient';
import { ApiError } from '../api/apiTypes';

export type DamageSeverity = 'Low' | 'Medium' | 'High';

export interface DamageAnalysis {
  damageType: string;
  severity: DamageSeverity;
  damageDescription: string;
  actionRecommended: string;
}

export interface DamageVisionResponse {
  isSuccess: boolean;
  analysis: DamageAnalysis;
  generatedAt: string;
}

export type DamageVisionErrorKind =
  | 'validation'
  | 'invalid_response'
  | 'provider_unavailable'
  | 'timeout'
  | 'unknown';

export interface DamageVisionError {
  status?: number;
  code?: string;
  kind: DamageVisionErrorKind;
  message: string;
}

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB (5,242,880 bytes)
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImageFile(file: File | null | undefined): void {
  if (!file) {
    throw {
      status: 400,
      code: 'VALIDATION_FILE_REQUIRED',
      kind: 'validation',
      message: 'Please select an image file to analyze.',
    } as DamageVisionError;
  }

  if (file.size === 0) {
    throw {
      status: 400,
      code: 'VALIDATION_FILE_EMPTY',
      kind: 'validation',
      message: 'The selected image file is empty. Please select a valid file.',
    } as DamageVisionError;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw {
      status: 400,
      code: 'VALIDATION_FILE_TOO_LARGE',
      kind: 'validation',
      message: 'The image file exceeds the maximum allowed size of 5 MiB.',
    } as DamageVisionError;
  }

  const name = file.name || '';
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex === -1) {
    throw {
      status: 400,
      code: 'VALIDATION_FILE_TYPE',
      kind: 'validation',
      message: 'The file has no extension. Only JPG, PNG, and WEBP formats are supported.',
    } as DamageVisionError;
  }

  const ext = name.slice(lastDotIndex).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw {
      status: 400,
      code: 'VALIDATION_FILE_TYPE',
      kind: 'validation',
      message: `Unsupported file format (${ext}). Only JPG, PNG, and WEBP formats are supported.`,
    } as DamageVisionError;
  }

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
    throw {
      status: 400,
      code: 'VALIDATION_MIME_TYPE',
      kind: 'validation',
      message: `Unsupported MIME type (${mime || 'unknown'}). Only JPG, PNG, and WEBP formats are supported.`,
    } as DamageVisionError;
  }

  // Cross-verify extension and MIME type match
  const isValidPair =
    ((ext === '.jpg' || ext === '.jpeg') && mime === 'image/jpeg') ||
    (ext === '.png' && mime === 'image/png') ||
    (ext === '.webp' && mime === 'image/webp');

  if (!isValidPair) {
    throw {
      status: 400,
      code: 'VALIDATION_MIME_MISMATCH',
      kind: 'validation',
      message: 'File extension and MIME type do not match. Please select a valid image file.',
    } as DamageVisionError;
  }
}

export function parseDamageVisionError(err: unknown): DamageVisionError {
  const apiErr = err as Partial<ApiError>;
  const status = apiErr?.status;
  const code = apiErr?.code;

  if (status === 400) {
    return {
      status: 400,
      code: code || 'VALIDATION_ERROR',
      kind: 'validation',
      message: 'The image could not be accepted. Use a valid JPG, PNG, or WEBP image up to 5 MiB.',
    };
  }

  if (status === 502 || code === 'AI_RESPONSE_INVALID') {
    return {
      status: 502,
      code: 'AI_RESPONSE_INVALID',
      kind: 'invalid_response',
      message: 'The AI vision response could not be processed.',
    };
  }

  if (status === 503 || code === 'AI_CONFIGURATION_MISSING' || code === 'AI_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      code,
      kind: 'provider_unavailable',
      message: 'AI vision service is currently unavailable. Inbound operations remain unaffected.',
    };
  }

  if (status === 504 || code === 'AI_TIMEOUT') {
    return {
      status: 504,
      code,
      kind: 'timeout',
      message: 'AI vision request timed out.',
    };
  }

  return {
    status,
    code,
    kind: 'unknown',
    message: 'AI damage analysis failed. Inbound operations remain unaffected.',
  };
}

export async function analyzeDamageImage(
  file: File,
  signal?: AbortSignal
): Promise<DamageVisionResponse> {
  validateImageFile(file);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await httpClient.post<DamageVisionResponse>(
      '/api/v1/InboundReceipts/report-damage',
      formData,
      { signal }
    );

    const payload = response.data;
    if (!payload || payload.isSuccess !== true || !payload.analysis || typeof payload.analysis !== 'object') {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Invalid damage vision payload received from server.',
      } as DamageVisionError;
    }

    const { analysis, generatedAt } = payload;
    const { damageType, severity, damageDescription, actionRecommended } = analysis;

    if (
      typeof damageType !== 'string' ||
      !damageType.trim() ||
      typeof damageDescription !== 'string' ||
      !damageDescription.trim() ||
      typeof actionRecommended !== 'string' ||
      !actionRecommended.trim() ||
      (severity !== 'Low' && severity !== 'Medium' && severity !== 'High') ||
      typeof generatedAt !== 'string' ||
      !generatedAt.trim() ||
      isNaN(Date.parse(generatedAt))
    ) {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Malformed damage vision analysis structure received from server.',
      } as DamageVisionError;
    }

    return {
      isSuccess: true,
      analysis: {
        damageType: damageType.trim(),
        severity,
        damageDescription: damageDescription.trim(),
        actionRecommended: actionRecommended.trim(),
      },
      generatedAt: generatedAt.trim(),
    };
  } catch (err: unknown) {
    if ((err as DamageVisionError)?.kind) {
      throw err;
    }
    throw parseDamageVisionError(err);
  }
}
