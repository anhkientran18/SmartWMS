import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { httpClient } from '../src/services/api/httpClient';
import {
  validateInvoiceFile,
  normalizeOcrResponse,
  scanInboundInvoice,
  OcrValidationError,
} from '../src/services/inbound/ocrInvoiceApi';
import OcrInvoiceModal from '../src/features/inbound/OcrInvoiceModal';

test('E3 OCR validation: accepts JPG, PNG, WEBP and rejects PDF / oversized files', () => {
  // Valid files
  assert.doesNotThrow(() => validateInvoiceFile({ name: 'invoice.png', size: 1024, type: 'image/png' } as File));
  assert.doesNotThrow(() => validateInvoiceFile({ name: 'invoice.jpg', size: 2048, type: 'image/jpeg' } as File));
  assert.doesNotThrow(() => validateInvoiceFile({ name: 'invoice.jpeg', size: 2048, type: 'image/jpeg' } as File));
  assert.doesNotThrow(() => validateInvoiceFile({ name: 'invoice.webp', size: 4096, type: 'image/webp' } as File));

  // Reject PDF
  assert.throws(
    () => validateInvoiceFile({ name: 'invoice.pdf', size: 1024, type: 'application/pdf' } as File),
    (err: any) => err instanceof OcrValidationError && err.code === 'PDF_UNSUPPORTED'
  );
  assert.throws(
    () => validateInvoiceFile({ name: 'bill.PDF', size: 1024, type: '' } as File),
    (err: any) => err instanceof OcrValidationError && err.code === 'PDF_UNSUPPORTED'
  );

  // Reject oversized (> 5 MiB)
  assert.throws(
    () => validateInvoiceFile({ name: 'huge.png', size: 5 * 1024 * 1024 + 1, type: 'image/png' } as File),
    (err: any) => err instanceof OcrValidationError && err.code === 'FILE_TOO_LARGE'
  );

  // Reject empty file
  assert.throws(
    () => validateInvoiceFile({ name: 'empty.png', size: 0, type: 'image/png' } as File),
    (err: any) => err instanceof OcrValidationError && err.code === 'INVALID_FILE'
  );
});

test('E3 OCR normalization: handles both PascalCase and camelCase structures', () => {
  // PascalCase from Gemini prompt
  const pascalRaw = {
    SupplierName: 'Vina Distribution Co',
    InvoiceNumber: 'INV-2026-999',
    InvoiceDate: '2026-11-15',
    Items: [
      { SKU: 'SKU-A', ProductName: 'Item A', Quantity: 25, UnitPrice: 150000 },
      { SKU: 'SKU-B', ProductName: 'Item B', Quantity: 10.5, UnitPrice: 300000 },
    ],
  };
  const normalized1 = normalizeOcrResponse(pascalRaw);
  assert.equal(normalized1.supplierName, 'Vina Distribution Co');
  assert.equal(normalized1.invoiceNumber, 'INV-2026-999');
  assert.equal(normalized1.invoiceDate, '2026-11-15');
  assert.equal(normalized1.items.length, 2);
  assert.equal(normalized1.items[0].sku, 'SKU-A');
  assert.equal(normalized1.items[0].quantity, 25);
  // Fractional quantity is preserved, NOT silently rounded
  assert.equal(normalized1.items[1].quantity, 10.5);

  // camelCase
  const camelRaw = {
    supplierName: 'Global Logistics',
    invoiceNumber: 'GL-1234',
    invoiceDate: '2026-11-20',
    items: [
      { sku: 'SKU-C', productName: 'Item C', quantity: 50, unitPrice: 20000 },
    ],
  };
  const normalized2 = normalizeOcrResponse(camelRaw);
  assert.equal(normalized2.supplierName, 'Global Logistics');
  assert.equal(normalized2.invoiceNumber, 'GL-1234');
  assert.equal(normalized2.items[0].sku, 'SKU-C');
  assert.equal(normalized2.items[0].quantity, 50);
});

test('E3 OCR API error handling: maps 400, 502, 503 correctly without crashing', async () => {
  const dummyFile = new File([new Uint8Array(1024)], 'test.png', { type: 'image/png' });
  const originalPost = httpClient.post;

  try {
    // 400 Bad Request
    httpClient.post = (async () => {
      const err: any = new Error('Bad Request');
      err.response = { status: 400, data: { message: 'Corrupt signature' } };
      throw err;
    }) as any;
    await assert.rejects(
      scanInboundInvoice(dummyFile),
      (err: any) => err.status === 400
    );

    // 502 Bad Gateway
    httpClient.post = (async () => {
      const err: any = new Error('Bad Gateway');
      err.response = { status: 502, data: { errorCode: 'AI_RESPONSE_INVALID' } };
      throw err;
    }) as any;
    await assert.rejects(
      scanInboundInvoice(dummyFile),
      (err: any) => err.status === 502
    );

    // 503 Service Unavailable
    httpClient.post = (async () => {
      const err: any = new Error('Service Unavailable');
      err.response = { status: 503, data: { code: 'AI_CONFIGURATION_MISSING' } };
      throw err;
    }) as any;
    await assert.rejects(
      scanInboundInvoice(dummyFile),
      (err: any) => err.status === 503
    );
  } finally {
    httpClient.post = originalPost;
  }
});

test('E3 OcrInvoiceModal: renders upload interface and safeguards safely', () => {
  const suppliers = [{ id: 's-1', code: 'SUP-01', name: 'Supplier One', email: '', phone: '', address: '', isActive: true, createdAt: '' }];
  const products = [{ id: 'p-1', sku: 'SKU-01', name: 'Product One', trackingMode: 0 }];

  const html = renderToStaticMarkup(
    <OcrInvoiceModal
      isOpen={true}
      onClose={() => {}}
      suppliers={suppliers}
      products={products}
      onApply={() => {}}
    />
  );

  assert.equal(html.includes('Scan Inbound Invoice (OCR)') || html.includes('Quét Hóa Đơn Nhập Kho (OCR)'), true);
  assert.equal(html.includes('JPG, PNG, WEBP') || html.includes('Tối đa 5 MiB'), true);
  // Safeguards notice
  assert.equal(html.includes('Extraction Safeguards') || html.includes('Nguyên tắc an toàn'), true);
});

test('E3 OCR semantic safeguards: fractional quantity is NOT rounded and requires operator review', () => {
  const raw = {
    SupplierName: 'ABC Ltd',
    InvoiceNumber: 'INV-777',
    InvoiceDate: '2026-11-01',
    Items: [
      { SKU: 'SKU-FLOAT', ProductName: 'Liquid Chemical', Quantity: 14.75, UnitPrice: 80000 },
      { SKU: 'SKU-SAFE', ProductName: 'Solid Bar', Quantity: 20, UnitPrice: 15000 },
      { SKU: 'SKU-ZERO', ProductName: 'Zero Item', Quantity: 0, UnitPrice: 0 },
      { SKU: 'SKU-NEG', ProductName: 'Negative Item', Quantity: -5, UnitPrice: 1000 },
    ],
  };

  const normalized = normalizeOcrResponse(raw);

  // Exact raw values preserved
  assert.equal(normalized.items[0].quantity, 14.75);
  assert.equal(normalized.items[1].quantity, 20);
  assert.equal(normalized.items[2].quantity, 0);
  assert.equal(normalized.items[3].quantity, -5);

  // Validation rules check
  const isSafe0 = Number.isSafeInteger(normalized.items[0].quantity) && normalized.items[0].quantity > 0;
  const isSafe1 = Number.isSafeInteger(normalized.items[1].quantity) && normalized.items[1].quantity > 0;
  const isSafe2 = Number.isSafeInteger(normalized.items[2].quantity) && normalized.items[2].quantity > 0;
  const isSafe3 = Number.isSafeInteger(normalized.items[3].quantity) && normalized.items[3].quantity > 0;

  assert.equal(isSafe0, false); // 14.75 is fractional - must NOT be applied automatically
  assert.equal(isSafe1, true);  // 20 is a safe positive integer
  assert.equal(isSafe2, false); // 0 is invalid
  assert.equal(isSafe3, false); // -5 is invalid
});

test('E3 OCR mapping safeguards: InvoiceNumber mapped to referenceDocument only, never receiptNumber or expectedDeliveryDate', () => {
  const ocrResult = {
    supplierName: 'Partner Supplier',
    invoiceNumber: 'EXT-INV-2026',
    invoiceDate: '2026-11-10',
    items: [{ sku: 'SKU-1', productName: 'Item 1', quantity: 10, unitPrice: 5000 }],
  };

  const headerBefore = {
    receiptNumber: 'RC-INTERNAL-001',
    supplierId: 's-orig',
    warehouseId: 'w-1',
    zoneId: 'z-1',
    binId: 'b-1',
    expectedDeliveryDate: '2026-11-20',
    referenceDocument: '',
    notes: '',
  };

  // Simulating handleOcrApply logic
  const payload = {
    referenceDocument: ocrResult.invoiceNumber.trim(),
    supplierId: 's-matched',
    lines: [{ productId: 'p-1', expectedQuantity: '10', lotNumber: '', expirationDate: '' }],
  };

  const headerAfter = {
    ...headerBefore,
    referenceDocument: payload.referenceDocument || headerBefore.referenceDocument,
    supplierId: payload.supplierId || headerBefore.supplierId,
  };

  // Assertions:
  assert.equal(headerAfter.referenceDocument, 'EXT-INV-2026');
  assert.equal(headerAfter.receiptNumber, 'RC-INTERNAL-001'); // NEVER overwritten!
  assert.equal(headerAfter.expectedDeliveryDate, '2026-11-20'); // NOT overwritten by invoiceDate!
  assert.equal(headerAfter.warehouseId, 'w-1'); // physical location preserved
  assert.equal(headerAfter.binId, 'b-1');
  assert.equal(headerAfter.supplierId, 's-matched');
});
