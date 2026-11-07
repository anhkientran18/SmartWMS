import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { autoUpdate, flip, FloatingFocusManager, FloatingPortal, offset, shift, size, useClick, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import { BinRead, ProductRead, WarehouseRead, ZoneRead } from '../../services/inventory/inventoryReadApi';

export const sameProduct = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export function binLabel(bin: BinRead | undefined, zones: ZoneRead[], warehouses: WarehouseRead[]) {
  if (!bin) return '—';
  const zone = zones.find(z => z.id === bin.zoneId);
  const warehouse = warehouses.find(w => w.id === zone?.warehouseId);
  return [bin.code, zone?.code, warehouse?.code].filter(Boolean).join(' · ');
}
interface Option { id: string; title: string; description?: string; disabled?: boolean }
function SearchPicker({ label, value, selected, options, search, setSearch, disabled, invalid, placeholder, loading, error, reload, footer, wide, onSelect, onOpen }: {
  label: string; value?: string; selected?: string; options: Option[]; search: string; setSearch: (s: string) => void;
  disabled?: boolean; invalid?: boolean; placeholder: string; loading?: boolean; error?: boolean; reload?: () => void;
  footer?: ReactNode; wide?: boolean; onSelect: (id: string) => void; onOpen?: (open: boolean) => void;
}) {
  const { t } = useTranslation(); const id = useId(); const [open, setOpen] = useState(false); const input = useRef<HTMLInputElement>(null);
  const changeOpen = (next: boolean) => { setOpen(next); onOpen?.(next); };
  const { refs, floatingStyles, context } = useFloating({ open, onOpenChange: changeOpen, placement: 'bottom-start', strategy: 'fixed', whileElementsMounted: autoUpdate,
    middleware: [offset(5), flip({ padding: 12 }), shift({ padding: 12 }), size({ padding: 12, apply({ availableHeight, availableWidth, rects, elements }) {
      Object.assign(elements.floating.style, { width: `${Math.min(availableWidth, Math.max(rects.reference.width, wide ? 370 : 300))}px`, maxHeight: `${Math.min(400, availableHeight)}px` });
    } })] });
  const { getReferenceProps, getFloatingProps } = useInteractions([useClick(context), useDismiss(context), useRole(context, { role: 'dialog' })]);
  useEffect(() => { if (disabled && open) changeOpen(false); }, [disabled, open]);
  return <div className="min-w-0">
    <span id={`${id}-label`} className="sr-only">{label}</span>
    <button type="button" ref={refs.setReference} {...getReferenceProps()} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} title={selected} className={`kit-select ${invalid ? '!border-rose-400' : ''}`}>
      <span id={`${id}-value`} className="truncate text-left">{selected || t('f7.choose')}</span><ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
    </button>
    {invalid && <p id={`${id}-error`} className="kit-field-error">{t('f7.fieldError')}</p>}
    {open && !disabled && <FloatingPortal><FloatingFocusManager context={context} modal={false} initialFocus={input} returnFocus>
      <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} aria-label={label} className="kit-picker z-40 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xl">
        <div className="flex items-center gap-2 p-3 border-b border-slate-100"><Search className="w-4 h-4 shrink-0 text-slate-400" /><input ref={input} aria-label={placeholder} placeholder={placeholder} className="min-w-0 w-full text-xs bg-white outline-none" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); refs.floating.current?.querySelector<HTMLButtonElement>('[role=option]:not(:disabled)')?.focus(); }
        }} /></div>
        <div role="listbox" aria-label={label} className="overflow-y-auto min-h-0 flex-1 p-1" onKeyDown={e => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
          const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement); if (index < 0) return;
          e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next]?.focus();
        }}>
          {loading ? <p role="status" className="p-3 text-xs text-slate-500">{t('f7.loading')}</p> : error ? <div role="alert" className="p-3 text-xs text-rose-700">{t('f7.readError')} <button type="button" className="underline ml-2" onClick={reload}>{t('f7.retry')}</button></div> : options.length ? options.map(option => <button type="button" key={option.id} role="option" aria-selected={sameProduct(value, option.id)} disabled={option.disabled} className={`w-full p-2.5 rounded-lg text-left flex gap-2 items-center hover:bg-slate-50 disabled:opacity-50 ${sameProduct(value, option.id) ? 'bg-blue-50 text-blue-700' : 'text-slate-800'}`} onClick={() => { onSelect(option.id); changeOpen(false); }}>
            <span className="min-w-0 flex-1"><strong className="block font-mono text-xs break-words">{option.title}</strong><span className="block text-xs text-slate-500 break-words">{option.description}</span>{option.disabled && <span className="block text-xs text-amber-800">{t('f7.serial')}</span>}</span>{sameProduct(value, option.id) && <Check className="w-4 h-4 shrink-0" />}
          </button>) : <p className="p-3 text-xs text-slate-500">{t('f7.empty')}</p>}
        </div>{footer}
      </div>
    </FloatingFocusManager></FloatingPortal>}
  </div>;
}

export function ProductPicker({ label, product, excludeId, disabled, invalid, onChange }: { label: string; product?: ProductRead; excludeId?: string; disabled?: boolean; invalid?: boolean; onChange: (product: ProductRead) => void }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false); const [search, setSearch] = useState(''); const [term, setTerm] = useState(''); const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 200); return () => clearTimeout(timer); }, [search]);
  const products = useQuery({ ...inventoryQueries.productsPage(page, term), enabled: open && !disabled });
  const options = products.isError ? [] : products.data?.items.filter(p => !sameProduct(p.id, excludeId)) ?? [];
  return <SearchPicker label={label} value={product?.id} selected={product && `${product.sku} — ${product.name}`} options={options.map(p => ({ id: p.id, title: p.sku, description: p.name, disabled: p.trackingMode === 2 }))} onOpen={setOpen} search={search} setSearch={setSearch} disabled={disabled} invalid={invalid} placeholder={t('f7.searchProducts')} loading={products.isFetching || search.trim() !== term} error={products.isError} reload={() => void products.refetch()} onSelect={id => { const selected = options.find(p => p.id === id); if (selected) onChange(selected); }}
    footer={products.data && !products.isError && <div className="p-2 border-t border-slate-100 flex justify-between gap-2 items-center text-xs"><button type="button" aria-label={t('f7.previous')} disabled={!products.data.hasPreviousPage || products.isFetching} onClick={() => setPage(p => p - 1)} className="disabled:opacity-30 px-2 py-1">‹</button><span>{t('f7.page', { page, total: Math.max(1, products.data.totalPages) })}</span><button type="button" aria-label={t('f7.next')} disabled={!products.data.hasNextPage || products.isFetching} onClick={() => setPage(p => p + 1)} className="disabled:opacity-30 px-2 py-1">›</button></div>} />;
}

export function BinPicker({ label, value, bins, zones, warehouses, disabled, invalid, onChange }: { label: string; value: string; bins: BinRead[]; zones: ZoneRead[]; warehouses: WarehouseRead[]; disabled?: boolean; invalid?: boolean; onChange: (id: string) => void }) {
  const { t } = useTranslation(); const [search, setSearch] = useState('');
  const options = bins.filter(b => binLabel(b, zones, warehouses).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(b => ({ id: b.id, title: b.code, description: binLabel(b, zones, warehouses) }));
  return <SearchPicker label={label} value={value} selected={value ? binLabel(bins.find(b => b.id === value), zones, warehouses) : undefined} options={options} search={search} setSearch={setSearch} disabled={disabled} invalid={invalid} placeholder={t('f7.searchBins')} wide onSelect={onChange} />;
}
