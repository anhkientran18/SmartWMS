import React, { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, RefreshCw, X, Calendar, Building2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface OrderFilterState {
  orderType: 'inbound' | 'outbound' | 'Inbound' | 'Outbound';
  searchKeyword: string;
  status: string;
  fromDate: string;
  toDate: string;
  partnerId: string;
}

interface OrderFilterBarProps {
  filters: OrderFilterState;
  onFilterChange: (filters: Partial<OrderFilterState>) => void;
  partners?: { id: string; name: any }[];
}

export default function OrderFilterBar({ filters, onFilterChange, partners = [] }: OrderFilterBarProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('vi') ? 'vi' : 'en';

  const [isExpanded, setIsExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.searchKeyword);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle debounce for search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (filters.searchKeyword !== localSearch) {
        onFilterChange({ searchKeyword: localSearch });
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [localSearch, filters.searchKeyword, onFilterChange]);

  const resetFilters = () => {
    setLocalSearch('');
    onFilterChange({
      searchKeyword: '',
      status: '',
      fromDate: '',
      toDate: '',
      partnerId: ''
    });
  };

  const handleOrderTypeChange = (type: 'inbound' | 'outbound') => {
    onFilterChange({ orderType: type, partnerId: '' }); // Reset partner when changing type as it differs
  };

  const activeAdvancedFiltersCount = [filters.status, filters.fromDate, filters.toDate, filters.partnerId].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
      {/* Top Main Toolbar */}
      <div className="p-4 sm:p-5 flex flex-col xl:flex-row items-center gap-4 bg-white z-10 relative border-b border-slate-100">

        {/* Search Input */}
        <div className="relative w-full xl:flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white focus:border-blue-500 transition-all text-slate-700 font-medium"
            placeholder={t('orders.searchPlaceholder')}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(''); onFilterChange({ searchKeyword: '' }); }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
              isExpanded || activeAdvancedFiltersCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <SlidersHorizontal className={`h-4 w-4 ${isExpanded ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>{t('common.buttons.filter')}</span>

            {activeAdvancedFiltersCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold ml-1 animate-pulse-once">
                {activeAdvancedFiltersCount}
              </span>
            )}
          </button>

          <button
            onClick={resetFilters}
            title={t('filters.reset')}
            className="flex items-center justify-center p-3 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all duration-200 shadow-sm"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Advanced Collapsible Panel */}
      <div
        className={`bg-slate-50/80 transition-all duration-300 ease-in-out ${
          isExpanded ? 'opacity-100 max-h-96 py-5' : 'opacity-0 max-h-0 py-0 hidden'
        }`}
      >
        <div className="px-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

          {/* Status Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t('orders.status')}
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ status: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm"
            >
              <option value="">{t('filters.all')}</option>
              <option value="Pending">{t('orders.statusOptions.pending')}</option>
              <option value="Processing">{t('orders.statusOptions.processing')}</option>
              <option value="Completed">{t('orders.statusOptions.completed')}</option>
              <option value="Cancelled">{t('orders.statusOptions.cancelled')}</option>
            </select>
          </div>

          {/* Partner Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3 w-3" />
              {filters.orderType === 'Inbound' || filters.orderType === 'inbound'
                ? t('orders.partner.vendor')
                : t('orders.partner.customer')}
            </label>
            <select
              value={filters.partnerId}
              onChange={(e) => onFilterChange({ partnerId: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm"
            >
              <option value="">{t('filters.allPartners')}</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name && typeof p.name === 'object' ? p.name[currentLang] : p.name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {t('filters.fromDate')}
            </label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => onFilterChange({ fromDate: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {t('filters.toDate')}
            </label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => onFilterChange({ toDate: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
