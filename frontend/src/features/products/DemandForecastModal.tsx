import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  BarChart2,
  Package,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import ActionButton from '../../components/common/ActionButton';
import {
  getDemandForecast,
  StockForecastDto,
  DemandForecastError,
} from '../../services/products/demandForecastApi';

export interface DemandForecastModalProduct {
  sku: string;
  name: string;
  unit?: string;
}

interface DemandForecastModalProps {
  product: DemandForecastModalProduct;
  onClose: () => void;
}

export function formatCalendarDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr || '';
  const yyyy = dateStr.slice(0, 4);
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);
  return `${dd}/${mm}/${yyyy}`;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr || '';
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);
  return `${dd}/${mm}`;
}

interface MergedChartPoint {
  rawDate: string;
  label: string;
  historical?: number;
  forecast?: number;
}

export default function DemandForecastModal({ product, onClose }: DemandForecastModalProps) {
  const { t, i18n } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [forecast, setForecast] = useState<StockForecastDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<DemandForecastError | null>(null);

  const titleId = useId();

  const fetchForecast = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getDemandForecast(product.sku, controller.signal);
      setForecast(data);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      setError(err as DemandForecastError);
      setForecast(null);
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
    void fetchForecast();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [product.sku]);

  // Merge points strictly from backend data for visualization without gap-filling or date synthesis
  const chartData: MergedChartPoint[] = [];
  if (forecast) {
    for (const h of forecast.historicalMovements) {
      chartData.push({
        rawDate: h.date,
        label: formatShortDate(h.date),
        historical: h.quantity,
      });
    }
    for (const f of forecast.forecastedDemand) {
      chartData.push({
        rawDate: f.date,
        label: formatShortDate(f.date),
        forecast: f.quantity,
      });
    }
    chartData.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }

  // Summary statistics across returned points only
  const unitSuffix = product.unit?.trim() ? ` ${product.unit.trim()}` : '';
  const numFmt = new Intl.NumberFormat(i18n.language);

  const forecastPointsCount = forecast?.forecastedDemand.length ?? 0;
  const forecastTotal = forecast?.forecastedDemand.reduce((acc, p) => acc + p.quantity, 0) ?? 0;
  const forecastPointAvg = forecastPointsCount > 0 ? (forecastTotal / forecastPointsCount).toFixed(1) : '0';

  const historyPointsCount = forecast?.historicalMovements.length ?? 0;
  const historyTotal = forecast?.historicalMovements.reduce((acc, p) => acc + p.quantity, 0) ?? 0;

  const isNoHistory =
    error?.kind === 'insufficient_or_unavailable_history' ||
    error?.kind === 'insufficient_history';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-4xl max-h-[92dvh] rounded-2xl border border-slate-200 shadow-2xl backdrop:bg-slate-900/40 overflow-hidden"
    >
      <div className="flex flex-col max-h-[92dvh] bg-white">
        {/* Header */}
        <header className="p-5 border-b border-slate-200 flex gap-3 items-start shrink-0 bg-white">
          <span className="p-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <TrendingUp className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                {product.sku}
              </span>
              <h2 id={titleId} className="font-bold text-base text-slate-900 break-words">
                {product.name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t('f8.demandForecast.subtitle', {
                defaultValue: 'AI-assisted demand projection based on historical outbound inventory consumption.',
              })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('f8.close', { defaultValue: 'Close' })}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-5">
          {/* Advisory Notice Banner */}
          <div
            role="note"
            className="flex items-start gap-3 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed"
          >
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                {t('f8.demandForecast.advisoryTitle', {
                  defaultValue: 'Advisory Outbound Demand Projection',
                })}
              </p>
              <p>
                {t('f8.demandForecast.advisoryText', {
                  defaultValue:
                    'This forecast is generated by AI using system-wide historical outbound consumption (picks) from the past 90 days across all warehouses. It is advisory only and does NOT constitute a replenishment directive, stock reservation, purchase order, or guaranteed customer demand. Operational records remain authoritative.',
                })}
              </p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div role="status" className="p-12 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-700">
                {t('f8.demandForecast.loading', {
                  defaultValue: 'Analyzing 90-day outbound consumption and generating AI forecast…',
                })}
              </p>
            </div>
          )}

          {/* Insufficient History / No-History State */}
          {!isLoading && isNoHistory && (
            <div
              role="status"
              className="p-8 text-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 space-y-3"
            >
              <Package className="w-8 h-8 text-amber-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-900">
                {t('f8.demandForecast.insufficientHistoryTitle', {
                  defaultValue: 'Insufficient Outbound History',
                })}
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {t('f8.demandForecast.insufficientHistoryMessage', {
                  defaultValue:
                    'Not enough outbound movement history is available to generate this forecast. Standard product inventory records remain authoritative.',
                })}
              </p>
              <div className="pt-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={() => void fetchForecast()}
                >
                  {t('f8.refresh', { defaultValue: 'Refresh' })}
                </ActionButton>
              </div>
            </div>
          )}

          {/* General Error State */}
          {!isLoading && error && !isNoHistory && (
            <div
              role="alert"
              className="p-6 rounded-2xl border border-rose-200 bg-rose-50/60 space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-semibold text-rose-900">
                    {t('f8.demandForecast.errorTitle', { defaultValue: 'Unable to Load Demand Forecast' })}
                  </p>
                  <p className="text-rose-700 mt-1">{error.message}</p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={() => void fetchForecast()}
                >
                  {t('f8.refresh', { defaultValue: 'Retry' })}
                </ActionButton>
              </div>
            </div>
          )}

          {/* Forecast Result Content */}
          {!isLoading && !error && forecast && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {t('f8.demandForecast.metrics.forecastPoints', {
                      defaultValue: 'Returned Forecast Points',
                    })}
                  </span>
                  <span className="text-lg font-bold text-purple-700 mt-1 block">
                    {t('f8.demandForecast.metrics.pointsCount', {
                      count: forecastPointsCount,
                      defaultValue: `${forecastPointsCount} points`,
                    })}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('f8.demandForecast.metrics.returnedPointsOnly', {
                      defaultValue: 'Generated within 30-day horizon',
                    })}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {t('f8.demandForecast.metrics.forecastTotal', {
                      defaultValue: 'Total Across Forecast Points',
                    })}
                  </span>
                  <span className="text-lg font-bold text-slate-900 mt-1 block">
                    {numFmt.format(forecastTotal)}
                    {unitSuffix}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('f8.demandForecast.metrics.acrossPoints', {
                      count: forecastPointsCount,
                      defaultValue: `Sum across ${forecastPointsCount} returned points`,
                    })}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {t('f8.demandForecast.metrics.dailyAverage', {
                      defaultValue: 'Avg per Forecast Point',
                    })}
                  </span>
                  <span className="text-lg font-bold text-slate-900 mt-1 block">
                    {forecastPointAvg}
                    {unitSuffix}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('f8.demandForecast.metrics.perDayAverage', { defaultValue: 'Mean across returned points' })}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {t('f8.demandForecast.metrics.historyPoints', {
                      defaultValue: 'Observed Outbound (90d window)',
                    })}
                  </span>
                  <span className="text-lg font-bold text-blue-700 mt-1 block">
                    {numFmt.format(historyTotal)}
                    {unitSuffix}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('f8.demandForecast.metrics.historyDaysCount', {
                      count: historyPointsCount,
                      defaultValue: `${historyPointsCount} active days`,
                    })}
                  </span>
                </div>
              </div>

              {/* Time Series Chart */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-600" />
                    {t('f8.demandForecast.chartTitle', {
                      defaultValue: 'Outbound Consumption History & AI Forecast',
                    })}
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <span className="w-3 h-0.5 bg-blue-600 rounded" />
                      {t('f8.demandForecast.legendHistory', {
                        defaultValue: 'Historical Outbound (90d window)',
                      })}
                    </span>
                    <span className="flex items-center gap-1.5 text-purple-700">
                      <span className="w-3 h-0.5 border-t-2 border-dashed border-purple-600" />
                      {t('f8.demandForecast.legendForecast', {
                        defaultValue: 'Returned AI Forecast',
                      })}
                    </span>
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '0.75rem',
                            border: '1px solid #e2e8f0',
                            fontSize: '11px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          labelFormatter={(_, items) => {
                            const raw = (items?.[0]?.payload as MergedChartPoint)?.rawDate;
                            return raw ? formatCalendarDate(raw) : '';
                          }}
                          formatter={(value: any, name: any) => [
                            `${numFmt.format(Number(value))}${unitSuffix}`,
                            name === 'historical'
                              ? t('f8.demandForecast.legendHistory', { defaultValue: 'Historical Outbound (90d window)' })
                              : t('f8.demandForecast.legendForecast', { defaultValue: 'Returned AI Forecast' }),
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="historical"
                          name="historical"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 2.5, fill: '#2563eb' }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          name="forecast"
                          stroke="#9333ea"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 2.5, fill: '#9333ea' }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-8">
                    {t('f8.demandForecast.noPoints', { defaultValue: 'No movement points to plot.' })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 shrink-0">
          <ActionButton variant="secondary" onClick={onClose}>
            {t('f8.close', { defaultValue: 'Close' })}
          </ActionButton>
        </footer>
      </div>
    </dialog>
  );
}
