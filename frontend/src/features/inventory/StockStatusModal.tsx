import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Lock,
  ShieldAlert,
  X,
} from 'lucide-react';
import i18n from '../../i18n';
import ActionButton from '../../components/common/ActionButton';
import { ApiError } from '../../services/api/apiTypes';
import { normalizeApiError } from '../../services/api/httpClient';
import {
  ALLOWED_MANUAL_STOCK_STATUSES,
  changeStockStatus,
  MAX_STATUS_REASON,
} from '../../services/inventory/inventoryMutationApi';
import {
  InventoryStatus,
  normalizeInventoryStatus,
} from '../../services/inventory/types';

export interface StockStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  onRefreshWarning?: (warningMessage: string) => void;
  binId: string;
  binCode: string;
  productId: string;
  productName: string;
  sku: string;
  lotNumber: string;
  currentStatus: string | number;
}

export function resolveInitialTargetStatus(
  currentStatus: string | number | undefined | null,
): InventoryStatus {
  const normalized = normalizeInventoryStatus(currentStatus);
  return normalized === InventoryStatus.Available
    ? InventoryStatus.QCHold
    : InventoryStatus.Available;
}

export function canSubmitStockStatusChange(params: {
  submitting: boolean;
  binId: string;
  productId: string;
  currentStatus: string | number;
  targetStatus: InventoryStatus;
  effectiveReason: string;
}): boolean {
  const normalizedCurrent = normalizeInventoryStatus(params.currentStatus);
  const trimmedReason = params.effectiveReason.trim();
  return (
    !params.submitting &&
    Boolean(params.binId) &&
    Boolean(params.productId) &&
    normalizedCurrent !== InventoryStatus.Reserved &&
    params.targetStatus !== InventoryStatus.Reserved &&
    (ALLOWED_MANUAL_STOCK_STATUSES as readonly number[]).includes(
      params.targetStatus,
    ) &&
    params.targetStatus !== normalizedCurrent &&
    trimmedReason.length >= 1 &&
    trimmedReason.length <= MAX_STATUS_REASON
  );
}

export interface StockStatusSubmissionOutcome {
  committed: boolean;
  refreshWarning: boolean;
  error?: ApiError;
  refreshError?: unknown;
}

export function createStockStatusSubmissionGate() {
  let inFlight = false;

  return {
    isInFlight: () => inFlight,
    async submit(params: {
      binId: string;
      productId: string;
      lotNumber: string;
      currentStatus: string | number;
      targetStatus: InventoryStatus;
      reasonCode: string;
      onClose?: () => void;
      onSuccess?: () => void | Promise<void>;
      onRefreshWarning?: (warningMessage: string) => void;
    }): Promise<StockStatusSubmissionOutcome> {
      if (inFlight) {
        return {
          committed: false,
          refreshWarning: false,
          error: normalizeApiError(409, {
            code: 'FE_STATUS_IN_FLIGHT',
            message: i18n.t('f2.submitting', {
              defaultValue: 'Đang xử lý…',
            }),
          }),
        };
      }

      const normalizedCurrent = normalizeInventoryStatus(params.currentStatus);
      if (normalizedCurrent === InventoryStatus.Reserved) {
        return {
          committed: false,
          refreshWarning: false,
          error: normalizeApiError(409, {
            code: 'FE_STATUS_RESERVED_LOCKED',
            message: i18n.t('f2.errors.reservedLocked', {
              defaultValue:
                'Dòng tồn kho đang ở trạng thái Đã giữ (Reserved) cho đơn xuất kho và không thể đổi trạng thái thủ công.',
            }),
          }),
        };
      }

      if (params.targetStatus === normalizedCurrent) {
        return {
          committed: false,
          refreshWarning: false,
          error: normalizeApiError(400, {
            code: 'FE_STATUS_NOOP',
            message: i18n.t('f2.errors.invalidStatusPayload', {
              defaultValue:
                'Trạng thái mới phải khác trạng thái hiện tại và không được là Đã giữ (Reserved).',
            }),
          }),
        };
      }

      inFlight = true;
      try {
        await changeStockStatus({
          binId: params.binId,
          productId: params.productId,
          lotNumber: params.lotNumber || '',
          newStatus: params.targetStatus,
          reasonCode: params.reasonCode,
        });
      } catch (err: unknown) {
        inFlight = false;
        const apiErr = (
          err && typeof err === 'object' && 'message' in err
            ? err
            : normalizeApiError(undefined)
        ) as ApiError;
        return {
          committed: false,
          refreshWarning: false,
          error: apiErr,
        };
      }

      inFlight = false;
      params.onClose?.();

      // Separate post-commit refresh failure from mutation failure.
      try {
        await params.onSuccess?.();
        return {
          committed: true,
          refreshWarning: false,
        };
      } catch (refreshError: unknown) {
        const warningMsg = i18n.t('f2.statusRefreshWarning', {
          defaultValue:
            'Đã đổi trạng thái tồn kho thành công, nhưng tải lại dữ liệu thất bại — vui lòng làm mới trang.',
        });
        params.onRefreshWarning?.(warningMsg);
        return {
          committed: true,
          refreshWarning: true,
          refreshError,
        };
      }
    },
  };
}

const inputClass =
  'w-full min-w-0 border border-slate-200 bg-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

const STATUS_NAMES: Record<InventoryStatus, string> = {
  [InventoryStatus.Available]: 'Available',
  [InventoryStatus.Reserved]: 'Reserved',
  [InventoryStatus.QCHold]: 'QCHold',
  [InventoryStatus.Damaged]: 'Damaged',
  [InventoryStatus.Expired]: 'Expired',
};

export default function StockStatusModal({
  isOpen,
  onClose,
  onSuccess,
  onRefreshWarning,
  binId,
  binCode,
  productId,
  productName,
  sku,
  lotNumber,
  currentStatus,
}: StockStatusModalProps) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const gateRef = useRef(createStockStatusSubmissionGate());

  const normalizedCurrent = normalizeInventoryStatus(currentStatus);
  const isReservedLocked = normalizedCurrent === InventoryStatus.Reserved;
  const currentStatusKey = STATUS_NAMES[normalizedCurrent] || 'Available';

  const [targetStatus, setTargetStatus] = useState<InventoryStatus>(() =>
    resolveInitialTargetStatus(currentStatus),
  );
  const [reasonCode, setReasonCode] = useState('QC_INSPECTION');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetStatus(resolveInitialTargetStatus(currentStatus));
      setReasonCode('QC_INSPECTION');
      setCustomReason('');
      setError(null);
      setRefreshWarning(null);
      if (typeof dialog.current?.showModal === 'function' && !dialog.current.open) {
        try {
          dialog.current.showModal();
        } catch {
          // Ignore in non-DOM/SSR environments.
        }
      }
    } else if (typeof dialog.current?.close === 'function' && dialog.current.open) {
      try {
        dialog.current.close();
      } catch {
        // Ignore in non-DOM/SSR environments.
      }
    }
  }, [isOpen, currentStatus]);

  if (!isOpen) return null;

  const effectiveReason =
    reasonCode === 'OTHER' ? customReason.trim() : reasonCode.trim();
  const isSameStatus = targetStatus === normalizedCurrent;
  const canSubmit = canSubmitStockStatusChange({
    submitting,
    binId,
    productId,
    currentStatus,
    targetStatus,
    effectiveReason,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || gateRef.current.isInFlight()) return;

    setSubmitting(true);
    setError(null);
    setRefreshWarning(null);

    const outcome = await gateRef.current.submit({
      binId,
      productId,
      lotNumber: lotNumber || '',
      currentStatus,
      targetStatus,
      reasonCode: effectiveReason,
      onClose,
      onSuccess,
      onRefreshWarning: msg => {
        setRefreshWarning(msg);
        onRefreshWarning?.(msg);
      },
    });

    if (!outcome.committed && outcome.error) {
      setError(
        outcome.error.message ||
          t('f2.errors.statusFailed', {
            defaultValue: 'Đổi trạng thái tồn kho thất bại.',
          }),
      );
    }
    setSubmitting(false);
  };

  return (
    <dialog
      ref={dialog}
      open
      onCancel={e => {
        e.preventDefault();
        if (!submitting) onClose();
      }}
      aria-labelledby="stock-status-title"
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-md max-h-[90dvh] rounded-2xl border-0 shadow-2xl backdrop:bg-slate-900/50 overflow-hidden"
    >
      <div className="flex flex-col max-h-[90dvh] bg-white text-slate-900">
        <header className="px-5 py-4 flex gap-3 items-center shrink-0 border-b border-slate-200">
          <span className="rounded-xl border border-blue-100 bg-blue-50 p-2 text-blue-600">
            <ArrowRightLeft className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="stock-status-title"
              className="text-base font-bold text-slate-900"
            >
              {t('f2.changeStatusTitle')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {sku} · {binCode || binId} · {t('f2.lot')}:{' '}
              {lotNumber || t('f2.adjustSafety.noLot')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t('f2.close')}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-4 text-xs"
        >
          {isReservedLocked && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex gap-2 items-start"
            >
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <div className="text-xs break-words">
                {t('f2.errors.reservedLocked')}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex gap-2 items-start"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs break-words">{error}</div>
            </div>
          )}

          {refreshWarning && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex gap-2 items-start"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="text-xs break-words">{refreshWarning}</div>
            </div>
          )}

          <fieldset
            disabled={submitting || isReservedLocked}
            className="space-y-4 min-w-0"
          >
            {/* Context overview */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <p className="text-slate-500">
                {t('f2.product')}:{' '}
                <strong className="text-slate-900 font-medium">
                  {productName || sku}
                </strong>
              </p>
              <p className="text-slate-500">
                {t('f2.currentStatus')}:{' '}
                <span className="font-semibold text-blue-700">
                  {t(`f2.statuses.${currentStatusKey}`, {
                    defaultValue: String(currentStatus),
                  })}
                </span>
              </p>
            </div>

            {/* Target Status Selection */}
            <div className="space-y-1.5">
              <label
                htmlFor="target-status"
                className="font-semibold text-slate-700 block"
              >
                {t('f2.targetStatus')} <span className="text-rose-500">*</span>
              </label>
              <select
                id="target-status"
                className={inputClass}
                value={targetStatus}
                onChange={e =>
                  setTargetStatus(Number(e.target.value) as InventoryStatus)
                }
                disabled={submitting || isReservedLocked}
              >
                <option value={InventoryStatus.Available}>
                  1 — {t('f2.statuses.Available')}
                </option>
                <option value={InventoryStatus.QCHold}>
                  3 — {t('f2.statuses.QCHold')}
                </option>
                <option value={InventoryStatus.Damaged}>
                  4 — {t('f2.statuses.Damaged')}
                </option>
                <option value={InventoryStatus.Expired}>
                  5 — {t('f2.statuses.Expired')}
                </option>
              </select>
              {isSameStatus && !isReservedLocked && (
                <p className="text-[11px] text-amber-700 font-medium">
                  {t('f2.errors.invalidStatusPayload')}
                </p>
              )}
              <p className="text-[11px] text-slate-500 flex gap-1.5 items-start mt-1">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{t('f2.reservedNotice')}</span>
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label
                htmlFor="status-reason"
                className="font-semibold text-slate-700 block"
              >
                {t('f2.reason')} <span className="text-rose-500">*</span>
              </label>
              <select
                id="status-reason"
                className={inputClass}
                value={reasonCode}
                onChange={e => setReasonCode(e.target.value)}
                disabled={submitting || isReservedLocked}
              >
                <option value="QC_INSPECTION">
                  {t('f2.reasonQcInspection')}
                </option>
                <option value="DEFECT_FOUND">
                  {t('f2.reasonDefectFound')}
                </option>
                <option value="EXPIRY_APPROACH">
                  {t('f2.reasonExpiryApproach')}
                </option>
                <option value="QC_PASSED">{t('f2.reasonQcPassed')}</option>
                <option value="OTHER">{t('f2.reasonOther')}</option>
              </select>
              {reasonCode === 'OTHER' && (
                <input
                  id="status-custom-reason"
                  type="text"
                  maxLength={MAX_STATUS_REASON}
                  placeholder={t('f2.customReasonPlaceholder')}
                  className={`${inputClass} mt-1`}
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  required
                  disabled={submitting || isReservedLocked}
                />
              )}
            </div>
          </fieldset>

          <footer className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
            <ActionButton
              variant="ghost"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              {t('f2.cancel')}
            </ActionButton>
            <ActionButton
              variant="primary"
              type="submit"
              disabled={!canSubmit}
              icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
            >
              {submitting ? t('f2.submitting') : t('f2.confirmChange')}
            </ActionButton>
          </footer>
        </form>
      </div>
    </dialog>
  );
}
