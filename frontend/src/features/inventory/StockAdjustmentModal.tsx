import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { BinContents, BinRead, ProductRead } from '../../services/inventory/inventoryReadApi';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import {
  ADJUSTMENT_REASON_CODES,
  AdjustStockRequest,
  MAX_ADJUSTMENT_QUANTITY,
  MAX_ADJUSTMENT_REASON,
} from '../../services/inventory/stockAdjustmentApi';
import {
  getStockAdjustmentOperation,
  PreSubmitStockSnapshot,
  stockAdjustmentErrorKey,
  StockAdjustmentOperationState,
} from '../../services/inventory/stockAdjustmentMutation';

export interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  initialBinId?: string;
  initialProductId?: string;
  initialLotNumber?: string;
  bins: BinRead[];
  products: ProductRead[];
}

const inputClass =
  'w-full min-w-0 border border-slate-200 bg-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

export function createStockAdjustmentEventHandlers(
  operation: Pick<
    ReturnType<typeof getStockAdjustmentOperation>,
    'submit' | 'reconcile' | 'acknowledge'
  >,
  onError?: (key: string | undefined) => void,
  onUnlocked?: () => void,
) {
  const owner = sessionStore.get();
  const report = (err: unknown) => {
    if (owner === sessionStore.get()) {
      onError?.(stockAdjustmentErrorKey(err as ApiError));
    }
  };
  const clear = () => {
    if (owner === sessionStore.get()) {
      onError?.(undefined);
    }
  };
  return {
    async submit(
      request: AdjustStockRequest,
      options?: {
        productTrackingMode?: number;
        snapshot?: PreSubmitStockSnapshot;
        onSuccess?: () => void | Promise<void>;
      },
    ) {
      clear();
      try {
        return await operation.submit(request, options);
      } catch (err) {
        report(err);
        return undefined;
      }
    },
    async reconcile() {
      clear();
      try {
        return await operation.reconcile();
      } catch (err) {
        report(err);
        return undefined;
      }
    },
    acknowledge(operatorConfirmed: boolean) {
      clear();
      try {
        const unlocked = operation.acknowledge(operatorConfirmed);
        if (unlocked && owner === sessionStore.get()) {
          onUnlocked?.();
        }
        return unlocked;
      } catch (err) {
        report(err);
        return false;
      }
    },
  };
}

export function StockAdjustmentReconciliationPanel({
  state,
  bins,
  products,
  onReconcile,
  onUnlock,
}: {
  state: StockAdjustmentOperationState;
  bins: BinRead[];
  products: ProductRead[];
  onReconcile: () => void;
  onUnlock: (confirmed: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [state.reconciled, state.request]);

  if (state.phase !== 'uncertain') return null;

  const req = state.request;
  const binLabel =
    state.snapshot?.binCode ||
    bins.find(b => b.id === req?.binId)?.code ||
    req?.binId ||
    '—';
  const productObj = products.find(p => p.id === req?.productId);
  const productLabel =
    state.snapshot?.productSku ||
    (productObj ? `${productObj.sku} — ${productObj.name}` : req?.productId || '—');
  const report = state.reconciliation;
  const formatNum = (n: number) => n.toLocaleString(i18n.language);

  return (
    <section
      role="alert"
      aria-live="polite"
      className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 space-y-3 text-xs"
    >
      <div className="flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <h3 className="font-bold text-amber-900">
            {t('f2.adjustSafety.uncertainTitle')}
          </h3>
          <p className="text-amber-800 leading-relaxed">
            {t('f2.adjustSafety.uncertainDesc')}
          </p>
        </div>
      </div>

      {req && (
        <div className="rounded-lg border border-amber-200 bg-white/80 p-3 space-y-1.5">
          <p className="font-semibold text-slate-700">
            {t('f2.adjustSafety.recordedRequest')}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
            <div>
              <dt className="text-slate-500 inline">{t('f2.bin')}: </dt>
              <dd className="font-mono font-semibold text-slate-900 inline break-all">
                {binLabel}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 inline">{t('f2.product')}: </dt>
              <dd className="font-mono font-semibold text-slate-900 inline break-all">
                {productLabel}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 inline">{t('f2.lot')}: </dt>
              <dd className="font-mono text-slate-900 inline">
                {req.lotNumber || t('f2.adjustSafety.noLot')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 inline">{t('f2.delta')}: </dt>
              <dd
                className={`font-mono font-bold inline ${
                  req.adjustmentQuantity > 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {req.adjustmentQuantity > 0
                  ? `+${formatNum(req.adjustmentQuantity)}`
                  : formatNum(req.adjustmentQuantity)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500 inline">{t('f2.reason')}: </dt>
              <dd className="font-mono text-slate-900 inline break-all">
                {req.reasonCode}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <p className="p-2.5 rounded-lg border border-amber-200 bg-amber-100/70 text-[11px] text-amber-900 leading-relaxed">
        {t('f2.adjustSafety.observationalNotice')}
      </p>

      {state.storageWarning && (
        <p role="alert" className="text-[11px] font-medium text-rose-700">
          {t('f2.adjustSafety.storageWarning')}
        </p>
      )}

      {state.reconcileError && (
        <div
          role="alert"
          className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{t('f2.adjustSafety.reconcileError')}</span>
        </div>
      )}

      <div>
        <ActionButton
          type="button"
          variant="secondary"
          disabled={Boolean(state.reconciling)}
          onClick={onReconcile}
          icon={
            <RefreshCw
              className={`w-3.5 h-3.5 ${state.reconciling ? 'animate-spin' : ''}`}
            />
          }
        >
          {state.reconciling
            ? t('f2.adjustSafety.reconciling')
            : t('f2.adjustSafety.reconcileBtn')}
        </ActionButton>
      </div>

      {state.reconciled && report && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-[11px] text-slate-800">
          <p className="font-bold text-slate-900">
            {t('f2.adjustSafety.reconcileReportTitle')}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <dt className="text-slate-500">{t('f2.adjustSafety.observedLotQty')}</dt>
              <dd className="font-mono font-bold text-sm text-slate-900">
                {formatNum(report.observedLotQuantity)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">
                {t('f2.adjustSafety.observedBinOccupancy')}
              </dt>
              <dd className="font-mono font-bold text-sm text-slate-900">
                {formatNum(report.currentBinOccupancy)} /{' '}
                {formatNum(report.binMaxCapacity)}
              </dd>
            </div>
            {report.previousBinQuantity !== undefined && (
              <div>
                <dt className="text-slate-500">
                  {t('f2.adjustSafety.previousSnapshotQty')}
                </dt>
                <dd className="font-mono text-slate-700">
                  {formatNum(report.previousBinQuantity)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500">
                {t('f2.adjustSafety.matchingHistoryCount')}
              </dt>
              <dd className="font-mono font-semibold text-slate-900">
                {report.matchingAdjustments.length}
              </dd>
            </div>
          </dl>

          {report.matchingAdjustments.length > 0 ? (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2 space-y-1">
              {report.matchingAdjustments.slice(0, 3).map(tx => (
                <li
                  key={tx.id}
                  className="pt-1 flex flex-wrap justify-between gap-2 font-mono text-[11px]"
                >
                  <span>
                    {tx.transactionType} ·{' '}
                    {tx.quantityChanged > 0
                      ? `+${tx.quantityChanged}`
                      : tx.quantityChanged}{' '}
                    · {tx.reasonCode}
                  </span>
                  <span className="text-slate-500">
                    {new Date(tx.createdAt).toLocaleString(i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 italic">
              {t('f2.adjustSafety.noMatchingHistory')}
            </p>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-amber-200/80 space-y-2.5">
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-amber-400"
            checked={confirmed}
            disabled={!state.reconciled || Boolean(state.reconciling)}
            onChange={e => setConfirmed(e.target.checked)}
          />
          <span className="text-[11px] text-amber-950 leading-snug">
            {t('f2.adjustSafety.confirmCheckbox')}
          </span>
        </label>
        <ActionButton
          type="button"
          variant="primary"
          disabled={!state.reconciled || !confirmed || Boolean(state.reconciling)}
          onClick={() => onUnlock(confirmed)}
        >
          {t('f2.adjustSafety.unlockBtn')}
        </ActionButton>
      </div>
    </section>
  );
}

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialBinId = '',
  initialProductId = '',
  initialLotNumber = '',
  bins,
  products,
}: StockAdjustmentModalProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const operation = getStockAdjustmentOperation(client);
  const state = useSyncExternalStore(
    operation.subscribe,
    operation.getState,
    operation.getState,
  );
  const dialog = useRef<HTMLDialogElement>(null);

  const [binId, setBinId] = useState(initialBinId);
  const [productId, setProductId] = useState(initialProductId);
  const [lotNumber, setLotNumber] = useState(initialLotNumber);
  const [deltaSign, setDeltaSign] = useState<'increase' | 'decrease'>('increase');
  const [quantityInput, setQuantityInput] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('AUDIT_CLEANUP');
  const [customReason, setCustomReason] = useState('');
  const [localErrorKey, setLocalErrorKey] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      const current = operation.rehydrate();
      setLocalErrorKey(undefined);
      if (
        (current.phase === 'uncertain' || current.phase === 'pending') &&
        current.request
      ) {
        setBinId(current.request.binId);
        setProductId(current.request.productId);
        setLotNumber(current.request.lotNumber);
        setDeltaSign(current.request.adjustmentQuantity >= 0 ? 'increase' : 'decrease');
        setQuantityInput(String(Math.abs(current.request.adjustmentQuantity)));
        if (
          (ADJUSTMENT_REASON_CODES as readonly string[]).includes(
            current.request.reasonCode,
          ) &&
          current.request.reasonCode !== 'OTHER'
        ) {
          setReasonCode(current.request.reasonCode);
          setCustomReason('');
        } else {
          setReasonCode('OTHER');
          setCustomReason(current.request.reasonCode);
        }
      } else if (!current.storageLocked) {
        operation.clearResolved();
        setBinId(initialBinId);
        setProductId(initialProductId);
        setLotNumber(initialLotNumber);
        setDeltaSign('increase');
        setQuantityInput('');
        setReasonCode('AUDIT_CLEANUP');
        setCustomReason('');
      }
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
  }, [isOpen, initialBinId, initialProductId, initialLotNumber, operation]);

  if (!isOpen) return null;

  const isPending = state.phase === 'pending';
  const isUncertain = state.phase === 'uncertain';
  const isLocked = isPending || isUncertain || Boolean(state.storageLocked);

  const selectedProduct = products.find(p => p.id === productId);
  const isSerial = selectedProduct?.trackingMode === 2;
  const isLot = selectedProduct?.trackingMode === 1;

  const trimmedQty = quantityInput.trim();
  const parsedQty = /^\d+$/.test(trimmedQty) ? Number(trimmedQty) : NaN;
  const isValidQty =
    Number.isSafeInteger(parsedQty) &&
    parsedQty >= 1 &&
    parsedQty <= MAX_ADJUSTMENT_QUANTITY;
  const deltaQuantity = isValidQty
    ? deltaSign === 'increase'
      ? parsedQty
      : -parsedQty
    : 0;
  const effectiveReason =
    reasonCode === 'OTHER' ? customReason.trim() : reasonCode.trim();
  const isValidReason =
    effectiveReason.length >= 1 && effectiveReason.length <= MAX_ADJUSTMENT_REASON;

  const canSubmit =
    !isLocked &&
    Boolean(binId) &&
    Boolean(productId) &&
    !isSerial &&
    isValidQty &&
    isValidReason;

  const handlers = createStockAdjustmentEventHandlers(
    operation,
    setLocalErrorKey,
    () => {
      setQuantityInput('');
      setCustomReason('');
      setReasonCode('AUDIT_CLEANUP');
    },
  );

  // Requirement 12: Closing the modal never clears an 'uncertain' or 'pending' journal entry.
  const handleClose = () => {
    if (isPending) return;
    if (!isUncertain && !state.storageLocked) {
      operation.clearResolved();
    }
    onClose();
  };

  const capturePreSubmitSnapshot = (): PreSubmitStockSnapshot => {
    const selectedBin = bins.find(b => b.id === binId);
    const cachedContents = binId
      ? client.getQueryData<BinContents>(inventoryQueries.contents(binId).queryKey)
      : undefined;
    const normalizedLot = isLot ? lotNumber.trim() : '';
    const matchingLotQty = cachedContents?.items
      .filter(
        row =>
          row.productId.toLowerCase() === productId.toLowerCase() &&
          (row.lotNumber || '').trim() === normalizedLot,
      )
      .reduce((sum, row) => sum + row.quantity, 0);

    return {
      binCode: selectedBin?.code || cachedContents?.binCode,
      productSku: selectedProduct?.sku,
      productName: selectedProduct?.name,
      previousBinQuantity: matchingLotQty,
      previousBinOccupancy:
        cachedContents?.currentOccupancy ?? selectedBin?.currentOccupancy,
      binMaxCapacity: cachedContents?.maxCapacity ?? selectedBin?.maxCapacity,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const result = await handlers.submit(
      {
        binId,
        productId,
        lotNumber: isLot ? lotNumber.trim() : '',
        adjustmentQuantity: deltaQuantity,
        reasonCode: effectiveReason,
      },
      {
        productTrackingMode: selectedProduct?.trackingMode,
        snapshot: capturePreSubmitSnapshot(),
        onSuccess,
      },
    );

    if (result?.phase === 'succeeded' && !result.refreshWarning) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialog}
      open
      onCancel={e => {
        e.preventDefault();
        handleClose();
      }}
      aria-labelledby="stock-adjust-title"
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] rounded-2xl border-0 shadow-2xl backdrop:bg-slate-900/50 overflow-hidden"
    >
      <div className="flex flex-col max-h-[90dvh] bg-white text-slate-900">
        <header className="px-5 py-4 flex gap-3 items-center shrink-0 border-b border-slate-200">
          <span className="rounded-xl border border-blue-100 bg-blue-50 p-2 text-blue-600">
            <SlidersHorizontal className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="stock-adjust-title"
              className="text-base font-bold text-slate-900"
            >
              {t('f2.adjustStockTitle')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('f2.adjustStockDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            aria-label={t('f2.close')}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-4 text-xs">
          {isPending && (
            <div
              role="status"
              className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex gap-2 items-center"
            >
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>{t('f2.adjustSafety.pendingNotice')}</span>
            </div>
          )}

          {state.phase === 'succeeded' && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2"
            >
              <div className="flex gap-2 items-center font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('f2.adjustSafety.succeededTitle')}</span>
              </div>
              {state.refreshWarning && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 flex gap-2 items-start"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{t('f2.adjustSafety.refreshWarning')}</span>
                </div>
              )}
            </div>
          )}

          {(state.phase === 'rejected' || localErrorKey) && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex gap-2 items-start"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs break-words space-y-1">
                <p className="font-semibold">
                  {t(localErrorKey || stockAdjustmentErrorKey(state.error))}
                </p>
                {state.error?.message &&
                  [400, 409, 422].includes(state.error.status ?? 0) &&
                  state.error.code !== 'FE_ADJUST_STORAGE' && (
                    <p>{state.error.message}</p>
                  )}
              </div>
            </div>
          )}

          <StockAdjustmentReconciliationPanel
            state={state}
            bins={bins}
            products={products}
            onReconcile={() => void handlers.reconcile()}
            onUnlock={confirmed => {
              handlers.acknowledge(confirmed);
            }}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isLocked} className="space-y-4 min-w-0">
              {/* Bin selection */}
              <div className="space-y-1.5">
                <label
                  htmlFor="adjust-bin"
                  className="font-semibold text-slate-700 block"
                >
                  {t('f2.bin')} <span className="text-rose-500">*</span>
                </label>
                <select
                  id="adjust-bin"
                  className={inputClass}
                  value={binId}
                  onChange={e => setBinId(e.target.value)}
                  required
                  disabled={isLocked}
                >
                  <option value="">{t('f2.selectBin')}</option>
                  {bins.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code} ({b.currentOccupancy}/{b.maxCapacity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product selection */}
              <div className="space-y-1.5">
                <label
                  htmlFor="adjust-product"
                  className="font-semibold text-slate-700 block"
                >
                  {t('f2.product')} <span className="text-rose-500">*</span>
                </label>
                <select
                  id="adjust-product"
                  className={inputClass}
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  required
                  disabled={isLocked}
                >
                  <option value="">{t('f2.selectProduct')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}{' '}
                      {p.trackingMode === 1
                        ? '[Lot]'
                        : p.trackingMode === 2
                          ? '[Serial]'
                          : ''}
                    </option>
                  ))}
                </select>
                {isSerial && (
                  <p
                    role="alert"
                    className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex gap-1.5 items-center"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('f2.serialNotice')}</span>
                  </p>
                )}
              </div>

              {/* Conditional Lot number input when trackingMode === 1 */}
              {isLot && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="adjust-lot"
                    className="font-semibold text-slate-700 block"
                  >
                    {t('f2.lot')}{' '}
                    <span className="text-slate-400 font-normal">
                      ({t('f2.optionalIfNone')})
                    </span>
                  </label>
                  <input
                    id="adjust-lot"
                    type="text"
                    className={inputClass}
                    placeholder="LOT-2026"
                    value={lotNumber}
                    onChange={e => setLotNumber(e.target.value)}
                    disabled={isLocked}
                  />
                </div>
              )}

              {/* Adjustment quantity delta */}
              <div className="space-y-1.5">
                <label
                  htmlFor="adjust-quantity"
                  className="font-semibold text-slate-700 block"
                >
                  {t('f2.adjustDelta')} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isLocked}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      deltaSign === 'increase'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setDeltaSign('increase')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('f2.increase')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      deltaSign === 'decrease'
                        ? 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setDeltaSign('decrease')}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>{t('f2.decrease')}</span>
                  </button>
                </div>
                <div className="relative mt-2">
                  <input
                    id="adjust-quantity"
                    type="number"
                    min="1"
                    max={MAX_ADJUSTMENT_QUANTITY}
                    step="1"
                    placeholder={t('f2.quantityPlaceholder')}
                    className={inputClass}
                    value={quantityInput}
                    onChange={e => setQuantityInput(e.target.value)}
                    required
                    disabled={isLocked}
                  />
                </div>
                {isValidQty && (
                  <p className="text-[11px] font-mono text-slate-600">
                    {t('f2.previewDelta')}{' '}
                    <strong
                      className={
                        deltaQuantity > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }
                    >
                      {deltaQuantity > 0 ? `+${deltaQuantity}` : deltaQuantity}
                    </strong>
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  {t('f2.adjustDeltaHint')}
                </p>
              </div>

              {/* Reason Code */}
              <div className="space-y-1.5">
                <label
                  htmlFor="adjust-reason"
                  className="font-semibold text-slate-700 block"
                >
                  {t('f2.reason')} <span className="text-rose-500">*</span>
                </label>
                <select
                  id="adjust-reason"
                  className={inputClass}
                  value={reasonCode}
                  onChange={e => setReasonCode(e.target.value)}
                  disabled={isLocked}
                >
                  <option value="AUDIT_CLEANUP">
                    AUDIT_CLEANUP — {t('f2.reasonAudit')}
                  </option>
                  <option value="DAMAGED_GOODS">
                    DAMAGED_GOODS — {t('f2.reasonDamage')}
                  </option>
                  <option value="CYCLE_COUNT_DISCREPANCY">
                    CYCLE_COUNT_DISCREPANCY — {t('f2.reasonCycle')}
                  </option>
                  <option value="STOCK_CORRECTION">
                    STOCK_CORRECTION — {t('f2.reasonCorrection')}
                  </option>
                  <option value="OTHER">{t('f2.reasonOther')}</option>
                </select>
                {reasonCode === 'OTHER' && (
                  <input
                    id="adjust-custom-reason"
                    type="text"
                    maxLength={MAX_ADJUSTMENT_REASON}
                    placeholder={t('f2.customReasonPlaceholder')}
                    className={`${inputClass} mt-1`}
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    required
                    disabled={isLocked}
                  />
                )}
              </div>
            </fieldset>

            <footer className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <ActionButton
                variant="ghost"
                type="button"
                onClick={handleClose}
                disabled={isPending}
              >
                {t('f2.cancel')}
              </ActionButton>
              <ActionButton
                variant="primary"
                type="submit"
                disabled={!canSubmit}
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              >
                {isPending ? t('f2.submitting') : t('f2.confirmAdjust')}
              </ActionButton>
            </footer>
          </form>
        </div>
      </div>
    </dialog>
  );
}
