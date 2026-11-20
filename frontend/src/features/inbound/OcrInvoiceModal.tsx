import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UploadCloud,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  scanInboundInvoice,
  validateInvoiceFile,
  OcrInvoiceResult,
} from '../../services/inbound/ocrInvoiceApi';
import { SupplierRecord } from '../../services/administration/adminApi';
import ActionButton from '../../components/common/ActionButton';

export interface AppliedOcrLine {
  productId: string;
  expectedQuantity: string;
  lotNumber: string;
  expirationDate: string;
}

export interface OcrApplyPayload {
  referenceDocument?: string;
  supplierId?: string;
  lines: AppliedOcrLine[];
}

interface ProductCatalogItem {
  id: string;
  sku: string;
  name: string;
  trackingMode: number;
}

interface OcrInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: SupplierRecord[];
  products: ProductCatalogItem[];
  onApply: (payload: OcrApplyPayload) => void;
}

interface ReviewRow {
  key: number;
  extractedSku: string;
  extractedName: string;
  rawQuantity: number;
  extractedUnitPrice: number;
  matchedProductId: string;
  confirmedQuantity: string;
  isFractionalOrInvalid: boolean;
  selected: boolean;
}

export default function OcrInvoiceModal({
  isOpen,
  onClose,
  suppliers,
  products,
  onApply,
}: OcrInvoiceModalProps) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrInvoiceResult | null>(null);

  // Review stage state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [mapReferenceDoc, setMapReferenceDoc] = useState(true);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  function handleFileSelect(selectedFile: File | null) {
    setScanError('');
    if (!selectedFile) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      return;
    }

    try {
      validateInvoiceFile(selectedFile);
      setFile(selectedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } catch (err: any) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setScanError(err.message || (en ? 'Invalid file selected.' : 'File đã chọn không hợp lệ.'));
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    handleFileSelect(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] || null;
    handleFileSelect(f);
  }

  async function handleScan() {
    if (!file) return;
    setScanError('');
    setIsScanning(true);

    try {
      const result = await scanInboundInvoice(file);
      setOcrResult(result);

      // Attempt exact safe supplier match
      const rawSup = result.supplierName.trim().toLowerCase();
      const matchedSup = suppliers.find(
        s => s.name.trim().toLowerCase() === rawSup || s.code.trim().toLowerCase() === rawSup
      );
      setSelectedSupplierId(matchedSup ? matchedSup.id : '');

      // Build review rows with strict semantic rules:
      // 1. Exact SKU matching only (trackingMode !== 2 for supported items)
      // 2. DO NOT round fractional quantities automatically.
      const rows: ReviewRow[] = result.items.map((item, idx) => {
        const itemSku = item.sku.trim().toLowerCase();
        const matchedProd = products.find(
          p => p.sku.trim().toLowerCase() === itemSku && p.trackingMode !== 2
        );

        const isSafeInt = Number.isSafeInteger(item.quantity) && item.quantity > 0;
        return {
          key: idx,
          extractedSku: item.sku,
          extractedName: item.productName,
          rawQuantity: item.quantity,
          extractedUnitPrice: item.unitPrice,
          matchedProductId: matchedProd ? matchedProd.id : '',
          confirmedQuantity: isSafeInt ? String(item.quantity) : '',
          isFractionalOrInvalid: !isSafeInt,
          selected: true,
        };
      });

      setReviewRows(rows);
    } catch (err: any) {
      setScanError(err?.message || (en ? 'Failed to extract invoice data. Please try again or create manually.' : 'Không thể bóc tách hóa đơn. Vui lòng thử lại hoặc lập phiếu thủ công.'));
    } finally {
      setIsScanning(false);
    }
  }

  function handleReset() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setScanError('');
    setOcrResult(null);
    setReviewRows([]);
    setSelectedSupplierId('');
  }

  function handleApply() {
    if (!ocrResult) return;

    // Filter only selected rows with a confirmed product and valid safe integer quantity
    const validLines: AppliedOcrLine[] = reviewRows
      .filter(
        r =>
          r.selected &&
          r.matchedProductId &&
          Number.isSafeInteger(Number(r.confirmedQuantity)) &&
          Number(r.confirmedQuantity) >= 1
      )
      .map(r => ({
        productId: r.matchedProductId,
        expectedQuantity: r.confirmedQuantity,
        lotNumber: '',
        expirationDate: '',
      }));

    onApply({
      referenceDocument: mapReferenceDoc ? ocrResult.invoiceNumber.trim() : undefined,
      supplierId: selectedSupplierId || undefined,
      lines: validLines,
    });

    onClose();
  }

  const applicableLinesCount = reviewRows.filter(
    r =>
      r.selected &&
      r.matchedProductId &&
      Number.isSafeInteger(Number(r.confirmedQuantity)) &&
      Number(r.confirmedQuantity) >= 1
  ).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <header className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ocr-modal-title" className="text-base font-bold">
                {t('inbound.ocr.modalTitle', en ? 'Scan Inbound Invoice (OCR)' : 'Quét Hóa Đơn Nhập Kho (OCR)')}
              </h2>
              <p className="text-xs text-slate-500">
                {t(
                  'inbound.ocr.modalSubtitle',
                  en
                    ? 'Extract invoice details with AI vision and review before applying to receipt.'
                    : 'Bóc tách thông tin hóa đơn bằng AI và kiểm tra trước khi đưa vào phiếu nhập.'
                )}
              </p>
            </div>
          </div>
          <ActionButton variant="ghost" isIconOnly aria-label={en ? 'Close modal' : 'Đóng cửa sổ'} icon={<X className="w-5 h-5" />} onClick={onClose} />
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {scanError && (
            <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <p className="font-semibold">{en ? 'OCR Extraction Error' : 'Lỗi Bóc Tách Hóa Đơn'}</p>
                <p>{scanError}</p>
                <p className="text-rose-600 text-[11px] font-medium">
                  {en
                    ? 'Manual receipt entry remains completely available. You can also re-upload a clear image.'
                    : 'Lập phiếu thủ công vẫn hoàn toàn khả dụng. Bạn cũng có thể tải lại ảnh rõ nét hơn.'}
                </p>
              </div>
            </div>
          )}

          {!ocrResult ? (
            /* Upload State */
            <div className="space-y-4">
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                  file
                    ? 'border-blue-300 bg-blue-50/20'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onFileInputChange}
                />
                <UploadCloud className="w-10 h-10 mx-auto text-blue-600 mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  {file ? file.name : en ? 'Click or drag invoice image here' : 'Nhấp hoặc kéo thả ảnh hóa đơn vào đây'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {en
                    ? 'Supported formats: JPG, PNG, WEBP (Max 5 MiB). PDF is not supported.'
                    : 'Định dạng hỗ trợ: JPG, PNG, WEBP (Tối đa 5 MiB). Không hỗ trợ PDF.'}
                </p>
                {file && (
                  <p className="text-xs text-blue-600 font-mono mt-2">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>

              {previewUrl && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={previewUrl}
                      alt="Invoice preview"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 text-xs">
                      <p className="font-semibold text-slate-800 truncate">{file?.name}</p>
                      <p className="text-slate-500">{en ? 'Ready to analyze' : 'Sẵn sàng phân tích'}</p>
                    </div>
                  </div>
                  <ActionButton
                    variant="primary"
                    icon={<FileSearch className="w-4 h-4" />}
                    isLoading={isScanning}
                    disabled={isScanning}
                    onClick={handleScan}
                  >
                    {en ? 'Extract Data' : 'Trích xuất dữ liệu'}
                  </ActionButton>
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  {en ? 'Extraction Safeguards' : 'Nguyên tắc an toàn bóc tách'}
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-slate-600">
                  <li>{en ? 'OCR only extracts values; it never automatically commits or creates warehouse records.' : 'OCR chỉ trích xuất dữ liệu; không tự động lưu hay tạo bản ghi trong kho.'}</li>
                  <li>{en ? 'Extracted quantities and products require human review and confirmation.' : 'Số lượng và sản phẩm trích xuất cần người vận hành xem xét và xác nhận.'}</li>
                  <li>{en ? 'Warehouse, zone, and bin assignments are physical locations decided by the operator.' : 'Nhà kho, phân khu và ô kệ tiếp nhận là vị trí vật lý do người lập phiếu chỉ định.'}</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Review & Match State */
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <span className="font-semibold text-slate-700">
                  {en ? 'Extracted Invoice Preview' : 'Xem Trước Dữ Liệu Hóa Đơn Trích Xuất'}
                </span>
                <ActionButton variant="secondary" size="sm" onClick={handleReset}>
                  {en ? 'Scan Another File' : 'Quét ảnh khác'}
                </ActionButton>
              </div>

              {/* Header Fields Review */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* Invoice Number & Reference Mapping */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {en ? 'Extracted Invoice Number' : 'Số Hóa Đơn Trích Xuất'}
                  </span>
                  <p className="font-mono font-bold text-sm text-slate-900 break-all">
                    {ocrResult.invoiceNumber || (en ? '— (Not found)' : '— (Không tìm thấy)')}
                  </p>
                  <label className="flex items-start gap-2 pt-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapReferenceDoc}
                      onChange={e => setMapReferenceDoc(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600 leading-tight">
                      {en ? 'Map to Reference Document (never internal Receipt Number)' : 'Gán vào Chứng từ tham chiếu (không gán vào Số phiếu nhập)'}
                    </span>
                  </label>
                </div>

                {/* Invoice Date - Preview Only */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {en ? 'Extracted Invoice Date' : 'Ngày Hóa Đơn Trích Xuất'}
                  </span>
                  <p className="font-mono font-bold text-sm text-slate-900">
                    {ocrResult.invoiceDate || (en ? '— (Not found)' : '— (Không tìm thấy)')}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    <Info className="w-3 h-3 inline mr-1 text-slate-400" />
                    {en ? 'Preview only. Expected delivery date remains independently scheduled.' : 'Chỉ để tham chiếu. Ngày giao dự kiến được ấn định độc lập.'}
                  </p>
                </div>

                {/* Supplier Matching */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {en ? 'Supplier' : 'Nhà Cung Cấp'}
                    </span>
                    {selectedSupplierId ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {en ? 'Matched' : 'Đã khớp'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {en ? 'Review required' : 'Cần chọn'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate" title={ocrResult.supplierName}>
                    {en ? 'OCR:' : 'Trích xuất:'} <strong className="text-slate-800">{ocrResult.supplierName || '—'}</strong>
                  </p>
                  <select
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50"
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="">{en ? '— Select system supplier —' : '— Chọn nhà cung cấp hệ thống —'}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Matching Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-800">
                    {en ? 'Extracted Invoice Items' : 'Mặt Hàng Trích Xuất'} ({reviewRows.length})
                  </span>
                  <span className="text-slate-500">
                    {applicableLinesCount} / {reviewRows.length} {en ? 'ready to apply' : 'sẵn sàng đưa vào phiếu'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[700px]">
                    <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={reviewRows.length > 0 && reviewRows.every(r => r.selected)}
                            onChange={e =>
                              setReviewRows(all =>
                                all.map(r => ({ ...r, selected: e.target.checked }))
                              )
                            }
                            aria-label={en ? 'Select all items' : 'Chọn tất cả mặt hàng'}
                          />
                        </th>
                        <th className="p-2.5">{en ? 'Extracted Item (OCR)' : 'Mặt hàng trích xuất'}</th>
                        <th className="p-2.5">{en ? 'System Product Match' : 'Khớp sản phẩm hệ thống'}</th>
                        <th className="p-2.5 w-32">{en ? 'Quantity' : 'Số lượng'}</th>
                        <th className="p-2.5 w-24 text-right">{en ? 'Unit Price' : 'Đơn giá'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewRows.map(row => (
                        <tr
                          key={row.key}
                          className={`hover:bg-slate-50/50 ${
                            !row.matchedProductId || row.isFractionalOrInvalid ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={e =>
                                setReviewRows(all =>
                                  all.map(r => (r.key === row.key ? { ...r, selected: e.target.checked } : r))
                                )
                              }
                              aria-label={en ? 'Select item' : 'Chọn mặt hàng'}
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-800">{row.extractedName}</div>
                            <div className="font-mono text-slate-500 text-[11px] mt-0.5">
                              {en ? 'SKU:' : 'Mã SKU:'} {row.extractedSku || '—'}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <select
                              aria-label={en ? 'System product match' : 'Sản phẩm hệ thống'}
                              className={`w-full text-xs border rounded-lg p-1.5 ${
                                row.matchedProductId
                                  ? 'border-emerald-300 bg-emerald-50/30 text-emerald-950'
                                  : 'border-amber-300 bg-amber-50/30 text-amber-950 font-medium'
                              }`}
                              value={row.matchedProductId}
                              onChange={e => {
                                const val = e.target.value;
                                setReviewRows(all =>
                                  all.map(r => (r.key === row.key ? { ...r, matchedProductId: val } : r))
                                );
                              }}
                            >
                              <option value="">
                                {en ? '— Unresolved (Select Product) —' : '— Chưa khớp (Chọn sản phẩm) —'}
                              </option>
                              {products
                                .filter(p => p.trackingMode !== 2)
                                .map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku} · {p.name}
                                  </option>
                                ))}
                            </select>
                            {!row.matchedProductId && (
                              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {en ? 'No exact SKU match found in catalog.' : 'Không khớp chính xác SKU trong danh mục.'}
                              </p>
                            )}
                          </td>
                          <td className="p-2.5">
                            <input
                              aria-label={en ? 'Confirmed quantity' : 'Số lượng xác nhận'}
                              type="number"
                              min={1}
                              step={1}
                              className={`w-full text-xs font-mono border rounded-lg p-1.5 ${
                                row.isFractionalOrInvalid || !row.confirmedQuantity
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                                  : 'border-slate-200 bg-white'
                              }`}
                              placeholder={en ? 'Enter integer' : 'Nhập số nguyên'}
                              value={row.confirmedQuantity}
                              onChange={e => {
                                const v = e.target.value;
                                const isInt = Number.isSafeInteger(Number(v)) && Number(v) > 0;
                                setReviewRows(all =>
                                  all.map(r =>
                                    r.key === row.key
                                      ? {
                                          ...r,
                                          confirmedQuantity: v,
                                          isFractionalOrInvalid: !isInt,
                                        }
                                      : r
                                  )
                                );
                              }}
                            />
                            {row.isFractionalOrInvalid && (
                              <p className="text-[10px] text-amber-700 mt-1 leading-tight">
                                {en
                                  ? `Raw: ${row.rawQuantity}. Must enter positive integer.`
                                  : `Gốc: ${row.rawQuantity}. Cần nhập số nguyên dương.`}
                              </p>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600">
                            {row.extractedUnitPrice ? row.extractedUnitPrice.toLocaleString(i18n.language) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <ActionButton variant="secondary" onClick={onClose}>
            {en ? 'Cancel' : 'Hủy bỏ'}
          </ActionButton>

          {ocrResult && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {applicableLinesCount === 0
                  ? en
                    ? 'No valid lines ready'
                    : 'Chưa có dòng hợp lệ'
                  : `${applicableLinesCount} ${en ? 'lines will be applied' : 'dòng sẽ được đưa vào'}`}
              </span>
              <ActionButton
                variant="primary"
                disabled={applicableLinesCount === 0}
                icon={<ArrowRight className="w-4 h-4" />}
                onClick={handleApply}
              >
                {en ? 'Apply to Receipt Form' : 'Áp dụng vào phiếu nhập'}
              </ActionButton>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
