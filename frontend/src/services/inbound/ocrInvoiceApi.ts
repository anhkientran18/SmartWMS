import { httpClient, normalizeApiError } from '../api/httpClient';
import { isDemoMode } from '../../app/dataMode';
import i18n from '../../i18n';

export interface OcrExtractedItem {
  sku: string;
  productName: string;
  quantity: number; // raw extracted number (can be integer or fractional)
  unitPrice: number;
}

export interface OcrInvoiceResult {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  items: OcrExtractedItem[];
}

export const MAX_INVOICE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export class OcrValidationError extends Error {
  readonly code: string;
  constructor(message: string, code = 'INVALID_FILE') {
    super(message);
    this.name = 'OcrValidationError';
    this.code = code;
  }
}

export function validateInvoiceFile(file: File): void {
  if (!file) {
    throw new OcrValidationError(i18n.t('inbound.ocr.errors.noFile', 'No file selected.'));
  }

  const name = file.name || '';
  const lower = name.toLowerCase();

  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    throw new OcrValidationError(
      i18n.t('inbound.ocr.errors.pdfNotSupported', 'PDF format is not supported. Please upload a JPG, PNG, or WEBP image.'),
      'PDF_UNSUPPORTED'
    );
  }

  if (file.size <= 0) {
    throw new OcrValidationError(i18n.t('inbound.ocr.errors.emptyFile', 'The selected file is empty.'));
  }

  if (file.size > MAX_INVOICE_IMAGE_BYTES) {
    throw new OcrValidationError(
      i18n.t('inbound.ocr.errors.fileTooLarge', 'File size exceeds 5 MiB limit.'),
      'FILE_TOO_LARGE'
    );
  }

  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
  const hasValidMime = ALLOWED_IMAGE_MIMES.includes(file.type.toLowerCase());

  if (!hasValidExt && !hasValidMime) {
    throw new OcrValidationError(
      i18n.t('inbound.ocr.errors.invalidType', 'Unsupported file type. Only JPG, PNG, and WEBP images are supported.'),
      'UNSUPPORTED_TYPE'
    );
  }
}

export function normalizeOcrResponse(raw: any): OcrInvoiceResult {
  if (!raw || typeof raw !== 'object') {
    return {
      supplierName: '',
      invoiceNumber: '',
      invoiceDate: '',
      items: [],
    };
  }

  const supplierName = String(raw.supplierName ?? raw.SupplierName ?? '').trim();
  const invoiceNumber = String(raw.invoiceNumber ?? raw.InvoiceNumber ?? '').trim();
  const invoiceDate = String(raw.invoiceDate ?? raw.InvoiceDate ?? '').trim();

  const rawItems = raw.items ?? raw.Items;
  const items: OcrExtractedItem[] = Array.isArray(rawItems)
    ? rawItems.map((item: any) => ({
        sku: String(item?.sku ?? item?.SKU ?? '').trim(),
        productName: String(item?.productName ?? item?.ProductName ?? '').trim(),
        quantity: Number(item?.quantity ?? item?.Quantity ?? 0),
        unitPrice: Number(item?.unitPrice ?? item?.UnitPrice ?? 0),
      }))
    : [];

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    items,
  };
}

export async function scanInboundInvoice(file: File, signal?: AbortSignal): Promise<OcrInvoiceResult> {
  validateInvoiceFile(file);

  if (isDemoMode) {
    throw normalizeApiError(403);
  }

  const formData = new FormData();
  formData.append('file', file, file.name);

  try {
    const response = await httpClient.post('/api/v1/InboundReceipts/scan-invoice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });

    if (response.data?.isSuccess !== true || !response.data?.data) {
      throw normalizeApiError(502, response.data);
    }

    return normalizeOcrResponse(response.data.data);
  } catch (err: any) {
    if (err?.name === 'OcrValidationError') {
      throw err;
    }
    const status = err?.status ?? err?.response?.status;
    const body = err?.response?.data;
    if (status === 400) {
      throw normalizeApiError(400, body || { message: i18n.t('inbound.ocr.errors.badRequest', 'Invalid image document for OCR extraction.') });
    }
    if (status === 502) {
      throw normalizeApiError(502, body || { message: i18n.t('inbound.ocr.errors.aiInvalid', 'AI vision could not extract valid invoice data.') });
    }
    if (status === 503) {
      throw normalizeApiError(503, body || { message: i18n.t('inbound.ocr.errors.aiUnavailable', 'AI service is currently unavailable or unconfigured.') });
    }
    throw normalizeApiError(status, body);
  }
}
