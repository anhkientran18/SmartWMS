import React, { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FilterState {
  searchKeyword: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  sortBy: string;
}

interface AdvancedFilterBarProps {
  onFilterChange: (filters: FilterState) => void;
  categories?: string[]; // Optional list of categories
}

export default function AdvancedFilterBar({ onFilterChange, categories = ['ELECTRONICS', 'BEVERAGE', 'FOOD', 'FURNITURE', 'APPAREL'] }: AdvancedFilterBarProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.includes('en') || false;

  const [isExpanded, setIsExpanded] = useState(false);

  // Filter states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // To prevent initial render from firing the debounced search unnecessarily if we want to optimize,
  // but using a simple useEffect timeout is usually fine.
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Default filter state for reset
  const resetFilters = () => {
    setSearchKeyword('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    // Immediate callback for explicit reset
    onFilterChange({
      searchKeyword: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest'
    });
  };

  // Debounced effect for triggering filter changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onFilterChange({
        searchKeyword,
        category,
        minPrice,
        maxPrice,
        sortBy
      });
    }, 500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchKeyword, category, minPrice, maxPrice, sortBy, onFilterChange]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-6 flex flex-col transition-all duration-300">
      {/* Main Row */}
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-center gap-4 z-10 bg-white">
        {/* Search Input (Takes ~60% width on large screens) */}
        <div className="relative w-full lg:w-3/5">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white focus:border-blue-500 transition-all text-slate-700 font-medium shadow-inner-sm"
            placeholder={t('filters.searchPlaceholder')}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full lg:w-auto ml-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
              isExpanded
                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
            }`}
          >
            <SlidersHorizontal className={`h-4 w-4 ${isExpanded ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>{t('filters.advanced')}</span>

            {/* Active filters counter badge */}
            {(category || minPrice || maxPrice || sortBy !== 'newest') && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold ml-1 animate-pulse-once">
                {[category, minPrice, maxPrice, sortBy !== 'newest'].filter(Boolean).length}
              </span>
            )}
          </button>

          <button
            onClick={resetFilters}
            title={t('filters.reset')}
            className="flex items-center justify-center p-3 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-650 hover:border-red-200 hover:bg-red-50 transition-all duration-200 shadow-sm"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Advanced Collapsible Panel */}
      <div
        className={`bg-slate-50/80 border-t border-slate-100 transition-all duration-300 ease-in-out ${
          isExpanded ? 'opacity-100 max-h-96 py-5' : 'opacity-0 max-h-0 py-0 hidden'
        }`}
      >
        <div className="px-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t('filters.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm"
            >
              <option value="">{t('filters.allCategories')}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Min Price Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t('filters.minPrice')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
              />
            </div>
          </div>

          {/* Max Price Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t('filters.maxPrice')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="1000.00"
                className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
              />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t('filters.sortBy')}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm"
            >
              <option value="newest">{t('filters.sortNewest')}</option>
              <option value="price_asc">{t('filters.sortPriceAsc')}</option>
              <option value="price_desc">{t('filters.sortPriceDesc')}</option>
              <option value="name_asc">{t('filters.sortNameAsc')}</option>
            </select>
          </div>

        </div>
      </div>
    </div>
  );
}
