import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { ProductRead } from '../../services/inventory/inventoryReadApi';
import { productMutationApi } from '../../services/products/productMutationApi';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: ProductRead | null;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  editProduct,
}: ProductFormModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(editProduct?.id);

  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [weight, setWeight] = useState<string>('0');
  const [trackingMode, setTrackingMode] = useState<0 | 1 | 2>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editProduct) {
      setSku(editProduct.sku || '');
      setBarcode(editProduct.barcode || '');
      setName(editProduct.name || '');
      setDescription(editProduct.description || '');
      setUnit(editProduct.unit || 'Pcs');
      setWeight(String(editProduct.weight ?? 0));
      setTrackingMode((editProduct.trackingMode ?? 0) as 0 | 1 | 2);
    } else {
      setSku('');
      setBarcode('');
      setName('');
      setDescription('');
      setUnit('Pcs');
      setWeight('0');
      setTrackingMode(0);
    }
  }, [isOpen, editProduct]);

  if (!isOpen) return null;

  const parsedWeight = Number(weight);
  const isWeightValid = Number.isFinite(parsedWeight) && parsedWeight >= 0;
  const isFormValid =
    Boolean(sku.trim()) &&
    sku.trim().length <= 50 &&
    Boolean(name.trim()) &&
    name.trim().length <= 200 &&
    Boolean(unit.trim()) &&
    unit.trim().length <= 20 &&
    isWeightValid &&
    [0, 1, 2].includes(trackingMode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || inFlightRef.current) return;

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        sku: sku.trim(),
        barcode: barcode.trim(),
        name: name.trim(),
        description: description.trim(),
        unit: unit.trim() || 'Pcs',
        weight: Number(weight) || 0,
        trackingMode,
      };

      if (isEdit && editProduct) {
        await productMutationApi.updateProduct({
          id: editProduct.id,
          ...payload,
        });
      } else {
        await productMutationApi.createProduct(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || t('f8.saveProductFailed'));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 id="product-form-modal-title" className="text-base font-bold text-slate-900">
                {isEdit ? t('f8.editProductTitle') : t('f8.createProductTitle')}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? editProduct?.sku : t('f8.createProductSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={t('f8.close')}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-form-sku" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('f8.sku')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="product-form-sku"
                type="text"
                required
                maxLength={50}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={loading}
                placeholder="SKU-001"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="product-form-barcode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('f8.barcode')}
              </label>
              <input
                id="product-form-barcode"
                type="text"
                maxLength={100}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={loading}
                placeholder="8938505974192"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="product-form-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('f8.name')} <span className="text-rose-500">*</span>
            </label>
            <input
              id="product-form-name"
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="product-form-unit" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('f8.unit')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="product-form-unit"
                type="text"
                required
                maxLength={20}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={loading}
                placeholder="Pcs"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="product-form-weight" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('f8.weight')} (kg)
              </label>
              <input
                id="product-form-weight"
                type="number"
                min={0}
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="product-form-tracking-mode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('f8.tracking')}
              </label>
              <select
                id="product-form-tracking-mode"
                value={trackingMode}
                onChange={(e) => setTrackingMode(Number(e.target.value) as 0 | 1 | 2)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>{t('f8.mode0')} (0)</option>
                <option value={1}>{t('f8.mode1')} (1)</option>
                <option value={2}>{t('f8.mode2')} (2)</option>
              </select>
            </div>
          </div>

          {isEdit && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              {t('f8.trackingModeChangeWarning')}
            </p>
          )}

          <div>
            <label htmlFor="product-form-description" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('f8.description')}
            </label>
            <textarea
              id="product-form-description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? t('common.saveChanges') : t('f8.createProductBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
