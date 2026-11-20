import { httpClient } from '../api/httpClient';
import { Result, ApiError } from '../api/apiTypes';

export interface ForecastPointDto {
  date: string;
  quantity: number;
}

export interface StockForecastDto {
  sku: string;
  historicalMovements: ForecastPointDto[];
  forecastedDemand: ForecastPointDto[];
}

export type DemandForecastDto = StockForecastDto;

export interface DemandForecastViewModel {
  sku: string;
  history: ForecastPointDto[];
  forecast: ForecastPointDto[];
}

export function toDemandForecastViewModel(dto: StockForecastDto): DemandForecastViewModel {
  return {
    sku: dto.sku,
    history: dto.historicalMovements.map(p => ({ date: p.date, quantity: p.quantity })),
    forecast: dto.forecastedDemand.map(p => ({ date: p.date, quantity: p.quantity })),
  };
}

export type DemandForecastErrorKind =
  | 'validation'
  | 'not_found'
  | 'insufficient_or_unavailable_history'
  | 'insufficient_history'
  | 'invalid_response'
  | 'provider_unavailable'
  | 'timeout'
  | 'unknown';

export interface DemandForecastError {
  status?: number;
  code?: string;
  kind: DemandForecastErrorKind;
  message: string;
}

export function parseDemandForecastError(err: unknown): DemandForecastError {
  const apiErr = err as Partial<ApiError>;
  const status = apiErr?.status;
  const code = apiErr?.code;
  const rawMsg = apiErr?.message || '';

  if (status === 404 || code === 'PRODUCT_NOT_FOUND' || code === 'PRD_001' || rawMsg.includes('Không tìm thấy')) {
    return {
      status: 404,
      code: code || 'PRODUCT_NOT_FOUND',
      kind: 'not_found',
      message: 'Product not found in system catalog.',
    };
  }

  if (status === 400) {
    if (code === 'VALIDATION_EMPTY') {
      return {
        status: 400,
        code,
        kind: 'validation',
        message: 'Product SKU cannot be empty.',
      };
    }
    // For GET /api/v1/Forecasts/demand-prediction?sku={sku}, any backend 400 on a valid product SKU
    // (such as code VAL_1000 with Vietnamese validation message
    // "Hệ thống chưa có đủ dữ liệu xuất kho của sản phẩm này trong 90 ngày qua để AI tiến hành dự báo.")
    // indicates insufficient or unavailable outbound movement history in the 90-day window.
    return {
      status: 400,
      code: code || 'VAL_1000',
      kind: 'insufficient_or_unavailable_history',
      message: 'Not enough outbound movement history is available to generate this forecast.',
    };
  }

  if (status === 503 || code === 'AI_CONFIGURATION_MISSING' || code === 'AI_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      code,
      kind: 'provider_unavailable',
      message: 'Demand forecast service is currently unavailable. Core operations remain unaffected.',
    };
  }

  if (status === 502 || code === 'AI_RESPONSE_INVALID') {
    return {
      status: 502,
      code,
      kind: 'invalid_response',
      message: 'The AI forecast response could not be processed.',
    };
  }

  if (status === 504 || code === 'AI_TIMEOUT') {
    return {
      status: 504,
      code,
      kind: 'timeout',
      message: 'Forecast request timed out.',
    };
  }

  return {
    status,
    code,
    kind: 'unknown',
    message: 'Demand forecast request failed. Core operations remain unaffected.',
  };
}

function validateForecastPoint(pt: unknown): ForecastPointDto {
  if (
    !pt ||
    typeof pt !== 'object' ||
    typeof (pt as any).date !== 'string' ||
    !(pt as any).date.trim() ||
    isNaN(Date.parse((pt as any).date)) ||
    typeof (pt as any).quantity !== 'number' ||
    !Number.isFinite((pt as any).quantity) ||
    !Number.isInteger((pt as any).quantity) ||
    (pt as any).quantity < 0
  ) {
    throw {
      status: 502,
      code: 'AI_RESPONSE_INVALID',
      kind: 'invalid_response',
      message: 'Forecast point contains invalid date or non-integer/negative quantity.',
    } as DemandForecastError;
  }

  return {
    date: (pt as any).date.trim(),
    quantity: (pt as any).quantity,
  };
}

export async function getDemandForecast(sku: string, signal?: AbortSignal): Promise<StockForecastDto> {
  const trimmed = sku.trim();

  if (!trimmed) {
    throw {
      status: 400,
      code: 'VALIDATION_EMPTY',
      kind: 'validation',
      message: 'Product SKU cannot be empty.',
    } as DemandForecastError;
  }

  try {
    const response = await httpClient.get<Result<StockForecastDto>>(
      `/api/v1/Forecasts/demand-prediction?sku=${encodeURIComponent(trimmed)}`,
      { signal }
    );

    const payload = response.data;
    if (!payload || payload.isSuccess !== true || !payload.data || typeof payload.data !== 'object') {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Invalid forecast payload received from server.',
      } as DemandForecastError;
    }

    const data = payload.data;
    if (
      typeof data.sku !== 'string' ||
      !data.sku.trim() ||
      !Array.isArray(data.historicalMovements) ||
      !Array.isArray(data.forecastedDemand)
    ) {
      throw {
        status: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: 'invalid_response',
        message: 'Malformed forecast structure received from server.',
      } as DemandForecastError;
    }

    // Strictly validate each point without inventing missing dates or filling zeros
    const validatedHistory = data.historicalMovements.map(validateForecastPoint);
    const validatedForecast = data.forecastedDemand.map(validateForecastPoint);

    return {
      sku: data.sku.trim(),
      historicalMovements: validatedHistory,
      forecastedDemand: validatedForecast,
    };
  } catch (err: unknown) {
    if ((err as DemandForecastError)?.kind) {
      throw err;
    }
    throw parseDemandForecastError(err);
  }
}
