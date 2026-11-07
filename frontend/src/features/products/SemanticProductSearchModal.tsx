import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Search, RefreshCw, X, Eye, AlertCircle, Info, Package } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import {
  searchSemanticProducts,
  SemanticProductDto,
  SemanticSearchError,
} from '../../services/products/semanticProductSearchApi';

interface SemanticProductSearchModalProps {
  onClose: () => void;
  onOpen: (id: string) => void;
}

export default function SemanticProductSearchModal({ onClose, onOpen }: SemanticProductSearchModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const pendingRef = useRef(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<SemanticSearchError | null>(null);

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const trimmed = query.trim();
    if (!trimmed || pendingRef.current) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    pendingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await searchSemanticProducts(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setResults(data);
      setHasSearched(true);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      setError(err as SemanticSearchError);
      setResults([]);
      setHasSearched(true);
    } finally {
      pendingRef.current = false;
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSearch();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="semantic-search-modal-title"
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] rounded-2xl border border-slate-200 shadow-2xl backdrop:bg-slate-900/40 overflow-hidden"
    >
      <div className="flex flex-col max-h-[90dvh] bg-white">
        {/* Header */}
        <header className="p-5 border-b border-slate-200 flex gap-3 items-start shrink-0 bg-white">
          <span className="p-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="semantic-search-modal-title" className="font-bold text-base text-slate-900">
              {t('f8.semanticSearch.title', { defaultValue: 'Semantic Product Search' })}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('f8.semanticSearch.subtitle', {
                defaultValue: 'Discover products conceptually using natural language embeddings.',
              })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('f8.close', { defaultValue: 'Close' })}
            onClick={() => dialogRef.current?.close()}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-4">
          {/* Advisory Notice Banner */}
          <div
            role="note"
            className="flex items-start gap-3 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed"
          >
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              {t('f8.semanticSearch.advisory', {
                defaultValue:
                  'Semantic search discovers conceptually similar products using AI embeddings. Standard product search remains authoritative for exact SKU, barcode, and full catalog search.',
              })}
            </p>
          </div>

          {/* Search Form */}
          <form className="space-y-3" onSubmit={handleSearch}>
            <div className="flex justify-between items-center">
              <label
                htmlFor="semantic-query-input"
                className="block text-xs font-semibold text-slate-700"
              >
                {t('f8.semanticSearch.placeholder', {
                  defaultValue: 'Describe what you are looking for…',
                })}
              </label>
              <span
                className={`text-[11px] font-mono ${
                  query.length >= 200 ? 'text-rose-600 font-bold' : 'text-slate-400'
                }`}
              >
                {t('f8.semanticSearch.charCount', { count: query.length, defaultValue: `${query.length} / 200` })}
              </span>
            </div>

            <textarea
              id="semantic-query-input"
              rows={3}
              maxLength={200}
              disabled={isLoading}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('f8.semanticSearch.placeholder', {
                defaultValue: 'Describe what you are looking for (e.g. high-capacity storage boxes, waterproof packing tape)...',
              })}
              className="w-full min-w-0 border border-slate-200 bg-white rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all disabled:opacity-50"
            />

            <div className="flex justify-end gap-2">
              <ActionButton
                type="submit"
                disabled={isLoading || !query.trim()}
                icon={
                  isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )
                }
              >
                {t(isLoading ? 'f8.semanticSearch.searching' : 'f8.semanticSearch.search', {
                  defaultValue: isLoading ? 'Searching...' : 'Search',
                })}
              </ActionButton>
            </div>
          </form>

          {isLoading && <p role="status">{t('f8.semanticSearch.searching')}</p>}

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{t(semanticSearchErrorKey(error))}</p>
              </div>
            </div>
          )}

          {hasSearched && !isLoading && !error && <SemanticSearchResults results={results} onOpen={onOpen} />}
        </div>
      </div>
    </dialog>
  );
}

export function semanticSearchErrorKey(error: SemanticSearchError): string {
  if (error.status === 401 || error.status === 403) return `f8.errors.${error.status}`;
  if (error.kind === 'validation' && !['VALIDATION_EMPTY', 'VALIDATION_TOO_LONG'].includes(error.code ?? '')) return 'f8.errors.invalid';
  const key = error.kind === 'validation' ? (error.code === 'VALIDATION_TOO_LONG' ? 'tooLong' : 'empty')
    : error.kind === 'provider_unavailable' ? 'unavailable'
    : error.kind === 'invalid_response' ? 'invalid'
    : error.kind === 'timeout' ? 'timeout' : 'general';
  return `f8.semanticSearch.errors.${key}`;
}

export function SemanticSearchResults({ results, onOpen }: { results: SemanticProductDto[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700">
          {results.length > 0
            ? t('f8.resultCount', { count: results.length, defaultValue: `${results.length} matching products` })
            : t('f8.semanticSearch.noMatches', { defaultValue: 'No semantic matches found' })}
        </h3>
      </div>

      {results.length === 0 ? (
        <div
          role="status"
          className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2"
        >
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-medium text-slate-700">
            {t('f8.semanticSearch.noMatches', { defaultValue: 'No semantic matches found' })}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('f8.semanticSearch.noMatchesHint', {
              defaultValue:
                'Try different descriptive terms, or use standard catalog search for exact SKU / barcode lookup.',
            })}
          </p>
        </div>
      ) : (
        <div
          role="region"
          aria-label={t('f8.semanticSearch.title')}
          className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1"
        >
          {results.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                    {item.sku}
                  </span>
                  <span
                    data-testid="similarity-badge"
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {t('f8.semanticSearch.similarity', {
                      score: item.similarityScore,
                      defaultValue: `${item.similarityScore}% match`,
                    })}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 break-words">
                  {item.name}
                </h4>
                {item.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 break-words">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="shrink-0 self-end sm:self-center">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => onOpen(item.id)}
                >
                  {t('f8.semanticSearch.viewDetails', { defaultValue: 'View Details' })}
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
