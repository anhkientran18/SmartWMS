import { useTranslation } from 'react-i18next';
import { Sparkles, Brain, Clock, ArrowDownLeft, ArrowUpRight, Info, RefreshCw } from 'lucide-react';
import { ExecutiveDashboardData } from '../../services/dashboard/executiveDashboardApi';

interface ExecutiveInsightCardProps {
  data?: ExecutiveDashboardData | null;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

export default function ExecutiveInsightCard({ data, isLoading, error, onRetry }: ExecutiveInsightCardProps) {
  const { t, i18n } = useTranslation();
  const en = Boolean(i18n.language?.startsWith('en'));

  const getInboundStatusLabel = (status: string) => {
    return t(`dashboard.executive.inboundStatuses.${status}`, { defaultValue: status });
  };

  const getOutboundStatusLabel = (status: string) => {
    return t(`dashboard.executive.outboundStatuses.${status}`, { defaultValue: status });
  };

  const getTransactionTypeLabel = (type: string) => {
    return t(`dashboard.executive.transactionTypes.${type}`, { defaultValue: type });
  };

  if (error && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {t('dashboard.executive.title', en ? 'Executive Overview & AI Insights' : 'Tổng quan Điều hành & Phân tích AI')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('dashboard.executive.subtitle', en ? 'Authoritative operational intelligence and warehouse performance analysis.' : 'Thông tin điều hành xác thực và phân tích hiệu suất kho bãi.')}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{en ? 'Retry' : 'Thử lại'}</span>
            </button>
          )}
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-800 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {en
                ? 'Executive insights are temporarily unavailable.'
                : 'Không thể tải phân tích điều hành lúc này.'}
            </p>
            <p className="text-amber-700">
              {en
                ? 'Core operational data remains available. Please try again.'
                : 'Dữ liệu vận hành cốt lõi vẫn hoạt động bình thường. Vui lòng thử lại.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 animate-pulse">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {t('dashboard.executive.title', en ? 'Executive Overview & AI Insights' : 'Tổng quan Điều hành & Phân tích AI')}
            </h2>
            <p className="text-xs text-slate-500">
              {en ? 'Loading operational data…' : 'Đang tải dữ liệu vận hành…'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    aiInsight = { aiAvailable: false, aiExecutiveSummary: '', totalProducts: 0, totalBins: 0, overallOccupancyPercentage: 0, aiErrorCode: null },
    inboundReceiptsByStatus = {},
    outboundOrdersByStatus = {},
    warehouse
  } = data;
  const recent = warehouse?.recentTransactions?.slice(0, 5) ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {t('dashboard.executive.title', en ? 'Executive Overview & AI Insights' : 'Tổng quan Điều hành & Phân tích AI')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('dashboard.executive.subtitle', en ? 'Authoritative operational intelligence and warehouse performance analysis.' : 'Dữ liệu điều hành chuẩn xác và phân tích hiệu suất kho bãi.')}
            </p>
          </div>
        </div>
        {isLoading && (
          <span className="text-xs text-slate-400">
            {en ? 'Updating…' : 'Đang cập nhật…'}
          </span>
        )}
      </div>

      {/* AI Summary / Graceful Offline Notice */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('dashboard.executive.aiAnalysisTitle', en ? 'AI Strategic Assessment' : 'Đánh giá Chiến lược AI')}</span>
          </div>
          {aiInsight.aiAvailable ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
              <Sparkles className="w-2.5 h-2.5" />
              {t('dashboard.executive.aiGenerated', en ? 'AI Generated' : 'Tạo bởi AI')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
              <Info className="w-2.5 h-2.5" />
              {t('dashboard.executive.aiOfflineBadge', en ? 'Standard Mode' : 'Chế độ Chuẩn')}
            </span>
          )}
        </div>

        {aiInsight.aiAvailable && aiInsight.aiExecutiveSummary ? (
          <p className="text-xs text-indigo-950 leading-relaxed">
            {aiInsight.aiExecutiveSummary}
          </p>
        ) : (
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <p>
              {t('dashboard.executive.aiUnavailableNotice', en
                ? 'AI insight is currently unavailable. Authoritative operational metrics are displayed directly from the warehouse database.'
                : 'Phân tích AI hiện chưa khả dụng. Dữ liệu vận hành được cập nhật trực tiếp từ cơ sở dữ liệu kho.')}
            </p>
          </div>
        )}
      </div>

      {/* Pipeline Distribution Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Inbound Statuses */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
              {t('dashboard.executive.inboundPipeline', en ? 'Inbound Receipts Pipeline' : 'Tiến độ Phiếu Nhập Kho')}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {t('dashboard.executive.totalCount', {
                count: Object.values(inboundReceiptsByStatus).reduce((a, b) => a + b, 0),
                defaultValue: en ? `Total: ${Object.values(inboundReceiptsByStatus).reduce((a, b) => a + b, 0)}` : `Tổng: ${Object.values(inboundReceiptsByStatus).reduce((a, b) => a + b, 0)}`
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(inboundReceiptsByStatus).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs"
              >
                <span className="text-slate-500">{getInboundStatusLabel(status)}:</span>
                <span className="font-bold text-slate-900 font-mono">{count}</span>
              </span>
            ))}
            {Object.keys(inboundReceiptsByStatus).length === 0 && (
              <span className="text-xs text-slate-400">{en ? 'No active receipts' : 'Chưa có phiếu nhập'}</span>
            )}
          </div>
        </div>

        {/* Outbound Statuses */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              {t('dashboard.executive.outboundPipeline', en ? 'Outbound Orders Pipeline' : 'Tiến độ Lệnh Xuất Kho')}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {t('dashboard.executive.totalCount', {
                count: Object.values(outboundOrdersByStatus).reduce((a, b) => a + b, 0),
                defaultValue: en ? `Total: ${Object.values(outboundOrdersByStatus).reduce((a, b) => a + b, 0)}` : `Tổng: ${Object.values(outboundOrdersByStatus).reduce((a, b) => a + b, 0)}`
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(outboundOrdersByStatus).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs"
              >
                <span className="text-slate-500">{getOutboundStatusLabel(status)}:</span>
                <span className="font-bold text-slate-900 font-mono">{count}</span>
              </span>
            ))}
            {Object.keys(outboundOrdersByStatus).length === 0 && (
              <span className="text-xs text-slate-400">{en ? 'No active orders' : 'Chưa có lệnh xuất'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Ledger Transactions */}
      {recent.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {t('dashboard.executive.recentTransactions', en ? 'Recent Ledger Transactions' : 'Giao Dịch Sổ Kho Gần Đây')}
            </span>
            <span className="text-slate-400 text-[11px]">{en ? 'Latest 5 entries' : '5 mục mới nhất'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[480px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">{en ? 'SKU' : 'Mã SKU'}</th>
                  <th className="p-2">{en ? 'Type' : 'Loại'}</th>
                  <th className="p-2 text-right">{en ? 'Quantity' : 'Số lượng'}</th>
                  <th className="p-2">{en ? 'Location' : 'Vị trí'}</th>
                  <th className="p-2 text-right">{en ? 'Time' : 'Thời gian'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2 font-mono font-semibold text-slate-800">{tx.sku}</td>
                    <td className="p-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        tx.transactionType === 'INBOUND' ? 'bg-blue-100 text-blue-700' :
                        tx.transactionType === 'OUTBOUND' ? 'bg-emerald-100 text-emerald-700' :
                        tx.transactionType === 'SHIP_CONFIRM' ? 'bg-teal-100 text-teal-700' :
                        tx.transactionType === 'RESERVATION' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {getTransactionTypeLabel(tx.transactionType)}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono font-medium text-slate-700">
                      {tx.quantityChanged > 0 ? `+${tx.quantityChanged}` : tx.quantityChanged}
                    </td>
                    <td className="p-2 font-mono text-slate-600">{tx.location || '—'}</td>
                    <td className="p-2 text-right text-slate-400 text-[11px]">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
