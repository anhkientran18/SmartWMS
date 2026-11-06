import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from "react-i18next";

export interface PaginationFooterProps {
  disabled?: boolean;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function PaginationFooter({
  disabled = false,
  pageIndex,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationFooterProps) {
  const { t } = useTranslation();

  const startRecord = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
  const endRecord = Math.min(pageIndex * pageSize, totalCount);

  // Calculate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, pageIndex - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="bg-white px-4 py-3 border border-x border-b border-slate-200/80 rounded-b-2xl shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500 font-sans select-none">
      <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto text-center sm:text-left justify-center sm:justify-start">
        <span className="font-medium">
          {t('common.pagination.display', { start: startRecord, end: endRecord, total: totalCount })}
        </span>

        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-2.5">
            <select
              aria-label={t('common.pagination.perPage')}
              disabled={disabled}
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1); // Reset to first page on sizing change
              }}
              className="border border-slate-300 rounded-lg bg-transparent text-xs text-slate-700 outline-none py-1 px-2 cursor-pointer focus:ring-2 focus:ring-blue-500/20 font-medium"
            >
              {[10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size} {t('common.pagination.perPage')}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
        <button
          onClick={() => onPageChange(1)}
          disabled={disabled || pageIndex <= 1}
          aria-label={t('common.pagination.first', 'Trang đầu')}
          title={t('common.pagination.first', 'Trang đầu')}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={disabled || pageIndex <= 1}
          aria-label={t('common.pagination.prev', 'Trang trước')}
          title={t('common.pagination.prev', 'Trang trước')}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-1 mx-1 font-mono">
          {getPageNumbers().map(pageNum => (
            <button
              disabled={disabled}
              aria-current={pageNum === pageIndex ? 'page' : undefined}
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              aria-label={t('common.pagination.pageNumber', { page: pageNum })}
              className={`min-w-[28px] h-7 px-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                pageNum === pageIndex
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={disabled || pageIndex >= totalPages || totalPages === 0}
          aria-label={t('common.pagination.next', 'Trang kế')}
          title={t('common.pagination.next', 'Trang kế')}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={disabled || pageIndex >= totalPages || totalPages === 0}
          aria-label={t('common.pagination.last', 'Trang cuối')}
          title={t('common.pagination.last', 'Trang cuối')}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
