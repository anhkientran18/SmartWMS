import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import {
  getSlottingRecommendations,
  SlottingRecommendation,
  SlottingError,
  VelocityClass,
} from '../../services/inventory/slottingRecommendationApi';

export interface ZoneOption {
  id: string;
  name: string;
  code?: string;
  warehouseId?: string;
}

interface AiSlottingModalProps {
  onClose: () => void;
  zones?: ZoneOption[];
  initialZoneId?: string;
}

export default function AiSlottingModal({
  onClose,
  zones = [],
  initialZoneId = '',
}: AiSlottingModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(initialZoneId);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SlottingRecommendation[] | null>(null);
  const [error, setError] = useState<SlottingError | null>(null);

  const titleId = useId();

  const handleScopeChange = (newZoneId: string) => {
    // Abort in-flight query when scope changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSelectedZoneId(newZoneId);
    setResults(null);
    setError(null);
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getSlottingRecommendations(
        selectedZoneId || null,
        controller.signal
      );
      setResults(data);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      setError(err as SlottingError);
      setResults(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getVelocityBadge = (velocity: VelocityClass) => {
    switch (velocity) {
      case 'Fast':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            {t('f2.slotting.velocityFast', { defaultValue: 'Fast Moving' })}
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            {t('f2.slotting.velocityMedium', { defaultValue: 'Medium Moving' })}
          </span>
        );
      case 'Slow':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            {t('f2.slotting.velocitySlow', { defaultValue: 'Slow Moving' })}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-5xl max-h-[92dvh] rounded-2xl border border-slate-200 shadow-2xl backdrop:bg-slate-900/40 overflow-hidden"
    >
      <div className="flex flex-col max-h-[92dvh] bg-white">
        {/* Header */}
        <header className="p-5 border-b border-slate-200 flex gap-3 items-start shrink-0 bg-white">
          <span className="p-2.5 rounded-xl border border-purple-100 bg-purple-50 text-purple-600">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-bold text-base text-slate-900 break-words">
              {t('f2.slotting.title', {
                defaultValue: 'AI Storage Zone Slotting Recommendations',
              })}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('f2.slotting.subtitle', {
                defaultValue:
                  'Analyze 30-day outbound velocity to suggest optimal storage zones and minimize travel distances.',
              })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('f4.close', { defaultValue: 'Close' })}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-5">
          {/* Advisory & Privacy Disclosure Banner */}
          <div
            role="note"
            className="flex items-start gap-3 p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 leading-relaxed space-y-1.5"
          >
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">
                {t('f2.slotting.advisoryTitle', {
                  defaultValue: 'Advisory Storage Zone Optimization Only',
                })}
              </p>
              <p className="text-blue-800">
                {t('f2.slotting.advisoryText', {
                  defaultValue:
                    'Recommendations optimize placement using recent outbound velocity and current zone context. Physical capacity and operational suitability must still be verified by warehouse staff.',
                })}
              </p>
              <p className="text-[11px] text-blue-700/90 pt-0.5">
                {t('f2.slotting.groundingNote', {
                  defaultValue:
                    'Grounded in 30-day outbound shipment ledger transactions. Does not move inventory, reserve stock, or execute put-away.',
                })}
              </p>
              <p className="text-[11px] text-blue-700/90">
                {t('f2.slotting.privacyNotice', {
                  defaultValue:
                    'Analysis is processed using external AI (Google Gemini). Transmitted data includes product SKU, name, 30-day pick counts, and zone names. Costs, customer info, and supplier identities are never transmitted.',
                })}
              </p>
            </div>
          </div>

          {/* Scope Controls */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <label
                htmlFor="slotting-zone-scope"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                {t('f2.slotting.scopeLabel', { defaultValue: 'Scope / Storage Zone:' })}
              </label>
              <select
                id="slotting-zone-scope"
                value={selectedZoneId}
                disabled={isLoading}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="border border-slate-300 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="">
                  {t('f2.slotting.allZones', { defaultValue: 'All eligible zones' })}
                </option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <ActionButton
              variant="primary"
              size="sm"
              disabled={isLoading}
              icon={
                isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )
              }
              onClick={() => void handleGenerate()}
            >
              {isLoading
                ? t('f2.slotting.generating', { defaultValue: 'Analyzing…' })
                : t('f2.slotting.generate', { defaultValue: 'Generate Recommendations' })}
            </ActionButton>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div role="status" className="p-10 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-700">
                {t('f2.slotting.loading', {
                  defaultValue:
                    'Analyzing 30-day outbound velocity and generating zone slotting recommendations…',
                })}
              </p>
            </div>
          )}

          {/* Error Message */}
          {!isLoading && error && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-xs space-y-2"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-900">
                    {t('f2.slotting.errors.title', {
                      defaultValue: 'Failed to Generate Recommendations',
                    })}
                  </p>
                  <p className="text-rose-700 mt-0.5">{error.message}</p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={() => void handleGenerate()}
                >
                  {t('f2.slotting.retry', { defaultValue: 'Retry' })}
                </ActionButton>
              </div>
            </div>
          )}

          {/* Empty Results State */}
          {!isLoading && !error && results !== null && results.length === 0 && (
            <div className="p-10 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                {t('f2.slotting.empty', {
                  defaultValue:
                    'No slotting recommendations are currently available for the selected scope.',
                })}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {t('f2.slotting.emptyHint', {
                  defaultValue:
                    'Ensure qualifying products with active stock have outbound shipment transactions in the past 30 days.',
                })}
              </p>
            </div>
          )}

          {/* Results Table */}
          {!isLoading && !error && results !== null && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-900">
                  {t('f2.slotting.recommendationsCount', {
                    count: results.length,
                    defaultValue: `${results.length} Zone Optimization Recommendations`,
                  })}
                </span>
                <span className="text-[11px] text-slate-500">
                  {t('f2.slotting.displayOrderNotice', {
                    defaultValue: 'Ranked by outbound transaction frequency',
                  })}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">
                        {t('f2.slotting.sku', { defaultValue: 'SKU' })}
                      </th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">
                        {t('f2.slotting.productName', { defaultValue: 'Product Name' })}
                      </th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">
                        {t('f2.slotting.currentZone', { defaultValue: 'Current Zone' })}
                      </th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">
                        {t('f2.slotting.suggestedZone', { defaultValue: 'Suggested Zone' })}
                      </th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">
                        {t('f2.slotting.velocity', { defaultValue: '30-Day Velocity' })}
                      </th>
                      <th className="px-3.5 py-2.5 min-w-[280px]">
                        {t('f2.slotting.reasoning', {
                          defaultValue: 'AI Reasoning & Rationale',
                        })}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((item) => {
                      const isSameZone = item.currentZone === item.suggestedZone;
                      return (
                        <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {item.sku}
                          </td>
                          <td className="px-3.5 py-3 font-medium text-slate-900">
                            {item.productName}
                          </td>
                          <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                              {item.currentZone}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-purple-50 border border-purple-200 font-semibold text-purple-900">
                                {item.suggestedZone}
                              </span>
                              {isSameZone && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  {t('f2.slotting.sameZoneOptimal', {
                                    defaultValue: 'No zone change suggested',
                                  })}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            {getVelocityBadge(item.velocityClass)}
                          </td>
                          <td className="px-3.5 py-3 text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {item.aiReasoning}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 shrink-0">
          <ActionButton variant="secondary" onClick={onClose}>
            {t('f4.close', { defaultValue: 'Close' })}
          </ActionButton>
        </footer>
      </div>
    </dialog>
  );
}
