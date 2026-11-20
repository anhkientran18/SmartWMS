import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { customerApi, CustomerRecord } from '../../services/customers/customerApi';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdOrUpdatedCustomerId?: string) => void;
  editCustomer?: CustomerRecord | null;
}

export default function CustomerModal({
  isOpen,
  onClose,
  onSuccess,
  editCustomer,
}: CustomerModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(editCustomer?.id);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editCustomer) {
      setCode(editCustomer.code || '');
      setName(editCustomer.name || '');
      setEmail(editCustomer.email || '');
      setPhone(editCustomer.phone || '');
      setDeliveryAddress(editCustomer.deliveryAddress || editCustomer.address || '');
    } else {
      setCode('');
      setName('');
      setEmail('');
      setPhone('');
      setDeliveryAddress('');
    }
  }, [isOpen, editCustomer]);

  if (!isOpen) return null;

  const isFormValid =
    Boolean(code.trim()) &&
    code.trim().length <= 50 &&
    Boolean(name.trim()) &&
    name.trim().length <= 200;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || inFlightRef.current) return;

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      if (isEdit && editCustomer) {
        await customerApi.updateCustomer({
          id: editCustomer.id,
          code: code.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          deliveryAddress: deliveryAddress.trim(),
        });
        onSuccess(editCustomer.id);
      } else {
        const newId = await customerApi.createCustomer({
          code: code.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          deliveryAddress: deliveryAddress.trim(),
        });
        onSuccess(newId);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || t('customer.saveFailed'));
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
      aria-labelledby="customer-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 id="customer-modal-title" className="text-base font-bold text-slate-900">
                {isEdit ? t('customer.editTitle') : t('customer.createTitle')}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? editCustomer?.code : t('customer.createSubtitle')}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              <label htmlFor="customer-form-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('customer.code')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-form-code"
                type="text"
                required
                maxLength={50}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                placeholder="CUST-001"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="customer-form-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('customer.phone')}
              </label>
              <input
                id="customer-form-phone"
                type="text"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                placeholder="0901234567"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="customer-form-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('customer.name')} <span className="text-rose-500">*</span>
            </label>
            <input
              id="customer-form-name"
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="customer-form-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('customer.email')}
            </label>
            <input
              id="customer-form-email"
              type="email"
              maxLength={100}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="contact@company.vn"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="customer-form-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('customer.deliveryAddress')}
            </label>
            <textarea
              id="customer-form-address"
              rows={2}
              maxLength={300}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
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
              {isEdit ? t('common.saveChanges') : t('customer.createBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
