import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { sessionStore } from '../../features/auth/session';
import { ApiError } from '../api/apiTypes';
import { normalizeApiError } from '../api/httpClient';
import { inventoryKey, inventoryQueries } from './inventoryQueries';
import {
  BinContents,
  BinStockRow,
  inventoryReadApi,
  StockHistory,
  StockSummary,
} from './inventoryReadApi';
import {
  AdjustStockRequest,
  adjustStockRequest,
  canAdjustStock,
  stockAdjustmentApi,
} from './stockAdjustmentApi';

export const STOCK_ADJUSTMENT_JOURNAL_PREFIX = 'smartwms.stock-adjustment.v1.';

export const DEFINITE_REJECTION_STATUSES = [400, 401, 403, 404, 409, 422] as const;

export interface PreSubmitStockSnapshot {
  binCode?: string;
  productSku?: string;
  productName?: string;
  previousBinQuantity?: number;
  previousBinOccupancy?: number;
  binMaxCapacity?: number;
}

export interface StockAdjustmentJournalEntry {
  version: 1;
  status: 'pending' | 'uncertain' | 'succeeded';
  sessionHash: string;
  request: AdjustStockRequest;
  createdAt: string;
  updatedAt: string;
  snapshot?: PreSubmitStockSnapshot;
}

export interface StockAdjustmentReconciliationReport {
  observedAt: string;
  binContents: BinContents;
  matchingRows: BinStockRow[];
  observedLotQuantity: number;
  previousBinQuantity?: number;
  previousBinOccupancy?: number;
  currentBinOccupancy: number;
  binMaxCapacity: number;
  recentAdjustments: StockHistory[];
  matchingAdjustments: StockHistory[];
  summary: StockSummary;
  // GET reads are observational context only and never prove whether the original POST committed.
  isObservationalOnly: true;
}

export interface StockAdjustmentOperationState {
  phase: 'ready' | 'pending' | 'succeeded' | 'rejected' | 'uncertain';
  request?: AdjustStockRequest;
  journal?: StockAdjustmentJournalEntry;
  snapshot?: PreSubmitStockSnapshot;
  error?: ApiError;
  reconciling?: boolean;
  reconciled?: boolean;
  reconciliation?: StockAdjustmentReconciliationReport;
  reconcileError?: ApiError;
  refreshing?: boolean;
  refreshWarning?: boolean;
  refreshError?: unknown;
  storageLocked?: boolean;
  storageWarning?: boolean;
}

export interface SubmitStockAdjustmentOptions {
  productTrackingMode?: number;
  snapshot?: PreSubmitStockSnapshot;
  onSuccess?: () => void | Promise<void>;
}

// Standard FIPS 180-4 SHA-256 implementation so session token hashing is deterministic
// and synchronous across browser (crypto.subtle) and Node test runtimes.
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(word => word.toString(16).padStart(8, '0'))
    .join('');
}

export async function hashSessionToken(token: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token),
    );
    return Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
  }
  return sha256Hex(token);
}

export function getJournalStorageKey(sessionHash: string): string {
  return `${STOCK_ADJUSTMENT_JOURNAL_PREFIX}${sessionHash}`;
}

export function isDefiniteRejection(error?: ApiError): boolean {
  if (!error || error.code === 'FE_ADJUST_CONTRACT') return false;
  return (
    typeof error.status === 'number' &&
    (DEFINITE_REJECTION_STATUSES as readonly number[]).includes(error.status)
  );
}

export function stockAdjustmentErrorKey(error?: ApiError): string {
  if (error?.code === 'FE_ADJUST_STORAGE') return 'f2.adjustSafety.errors.storage';
  if (error?.code === 'FE_ADJUST_SERIAL_BLOCKED') return 'f2.serialNotice';
  if (error?.code === 'FE_ADJUST_VALIDATION') return 'f2.errors.invalidAdjustPayload';
  if (
    error?.code === 'FE_ADJUST_LOCKED' ||
    error?.code === 'FE_ADJUST_IN_FLIGHT' ||
    error?.code === 'FE_ADJUST_RECONCILE_REQUIRED'
  ) {
    return 'f2.adjustSafety.errors.locked';
  }
  if (error?.code === 'FE_ADJUST_CONTRACT') return 'f2.adjustSafety.errors.contract';
  if ([400, 401, 403, 404, 409, 422].includes(error?.status ?? 0)) {
    return `f2.adjustSafety.errors.${error!.status}`;
  }
  return error?.status === undefined
    ? 'f2.adjustSafety.errors.network'
    : 'f2.adjustSafety.errors.server';
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function parseSnapshot(value: unknown): PreSubmitStockSnapshot | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) throw new Error('Invalid snapshot');
  const snapshot: PreSubmitStockSnapshot = {};
  if (value.binCode !== undefined) {
    if (typeof value.binCode !== 'string') throw new Error('Invalid snapshot binCode');
    snapshot.binCode = value.binCode;
  }
  if (value.productSku !== undefined) {
    if (typeof value.productSku !== 'string') throw new Error('Invalid snapshot productSku');
    snapshot.productSku = value.productSku;
  }
  if (value.productName !== undefined) {
    if (typeof value.productName !== 'string') throw new Error('Invalid snapshot productName');
    snapshot.productName = value.productName;
  }
  if (value.previousBinQuantity !== undefined) {
    if (typeof value.previousBinQuantity !== 'number' || !Number.isFinite(value.previousBinQuantity)) {
      throw new Error('Invalid snapshot previousBinQuantity');
    }
    snapshot.previousBinQuantity = value.previousBinQuantity;
  }
  if (value.previousBinOccupancy !== undefined) {
    if (typeof value.previousBinOccupancy !== 'number' || !Number.isFinite(value.previousBinOccupancy)) {
      throw new Error('Invalid snapshot previousBinOccupancy');
    }
    snapshot.previousBinOccupancy = value.previousBinOccupancy;
  }
  if (value.binMaxCapacity !== undefined) {
    if (typeof value.binMaxCapacity !== 'number' || !Number.isFinite(value.binMaxCapacity)) {
      throw new Error('Invalid snapshot binMaxCapacity');
    }
    snapshot.binMaxCapacity = value.binMaxCapacity;
  }
  return snapshot;
}

export function parseJournalEntry(
  raw: string,
  expectedSessionHash?: string,
): StockAdjustmentJournalEntry {
  const parsed = JSON.parse(raw);
  if (!isObject(parsed)) throw new Error('Invalid journal object');
  if (parsed.version !== 1) throw new Error('Unsupported journal version');
  if (
    parsed.status !== 'pending' &&
    parsed.status !== 'uncertain' &&
    parsed.status !== 'succeeded'
  ) {
    throw new Error('Invalid journal status');
  }
  if (
    typeof parsed.sessionHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(parsed.sessionHash) ||
    (expectedSessionHash !== undefined && parsed.sessionHash !== expectedSessionHash)
  ) {
    throw new Error('Invalid journal sessionHash');
  }
  if (
    typeof parsed.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(parsed.createdAt)) ||
    typeof parsed.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(parsed.updatedAt))
  ) {
    throw new Error('Invalid journal timestamps');
  }
  const request = adjustStockRequest(parsed.request as AdjustStockRequest);
  const snapshot = parseSnapshot(parsed.snapshot);
  return {
    version: 1,
    status: parsed.status,
    sessionHash: parsed.sessionHash,
    request,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    ...(snapshot ? { snapshot } : {}),
  };
}

const storageError = () =>
  normalizeApiError(400, {
    code: 'FE_ADJUST_STORAGE',
  });

export function writeAndVerifyJournal(
  storageKey: string,
  entry: StockAdjustmentJournalEntry,
): StockAdjustmentJournalEntry {
  try {
    if (typeof globalThis.sessionStorage === 'undefined') {
      throw new Error('sessionStorage unavailable');
    }
    const serialized = JSON.stringify(entry);
    globalThis.sessionStorage.setItem(storageKey, serialized);
    const readBack = globalThis.sessionStorage.getItem(storageKey);
    if (typeof readBack !== 'string' || !readBack) {
      throw new Error('Journal read-back empty');
    }
    const verified = parseJournalEntry(readBack, entry.sessionHash);
    if (
      verified.status !== entry.status ||
      verified.updatedAt !== entry.updatedAt ||
      verified.request.binId !== entry.request.binId ||
      verified.request.productId !== entry.request.productId ||
      verified.request.lotNumber !== entry.request.lotNumber ||
      verified.request.adjustmentQuantity !== entry.request.adjustmentQuantity ||
      verified.request.reasonCode !== entry.request.reasonCode
    ) {
      throw new Error('Journal read-back mismatch');
    }
    return verified;
  } catch {
    throw storageError();
  }
}

async function freshQueryRead<T>(
  client: QueryClient,
  queryKey: readonly unknown[],
  read: (signal: AbortSignal) => Promise<T>,
  isCurrent: () => boolean,
): Promise<T> {
  const checkSession = () => {
    if (!isCurrent()) throw normalizeApiError(401);
  };
  checkSession();
  await client.cancelQueries({ queryKey, exact: true });
  checkSession();
  return client.fetchQuery({
    queryKey,
    staleTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      checkSession();
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal.aborted) abort();
      signal.addEventListener('abort', abort, { once: true });
      const unsubscribe = sessionStore.subscribe(() => {
        if (!isCurrent()) abort();
      });
      try {
        const value = await read(controller.signal);
        checkSession();
        return value;
      } finally {
        unsubscribe();
        signal.removeEventListener('abort', abort);
      }
    },
  });
}

export async function refreshStockAdjustmentReads(
  client: QueryClient,
  request: AdjustStockRequest,
  isCurrent = () => true,
): Promise<void> {
  const checkSession = () => {
    if (!isCurrent()) throw normalizeApiError(401);
  };
  checkSession();
  await client.invalidateQueries({ queryKey: inventoryKey, refetchType: 'none' });
  checkSession();

  const contentsKey = inventoryQueries.contents(request.binId).queryKey;
  const summaryKey = inventoryQueries.summary().queryKey;
  const requiredKeys = [contentsKey, summaryKey];

  // Best-effort refresh of other active inventory observers without blocking or leaking errors.
  void Promise.resolve()
    .then(() => {
      checkSession();
      return client.refetchQueries(
        {
          type: 'active',
          predicate: query =>
            query.queryKey[0] === 'private' &&
            query.queryKey[1] === 'inventory' &&
            !requiredKeys.some(key => JSON.stringify(key) === JSON.stringify(query.queryKey)),
        },
        { throwOnError: true },
      );
    })
    .catch(() => undefined);

  await freshQueryRead(
    client,
    contentsKey,
    signal => inventoryReadApi.contents(request.binId, signal),
    isCurrent,
  );
  await freshQueryRead(
    client,
    summaryKey,
    signal => inventoryReadApi.summary(signal),
    isCurrent,
  );
  checkSession();
}

export async function reconcileStockAdjustmentReads(
  client: QueryClient,
  request: AdjustStockRequest,
  snapshot?: PreSubmitStockSnapshot,
  isCurrent = () => true,
): Promise<StockAdjustmentReconciliationReport> {
  const checkSession = () => {
    if (!isCurrent()) throw normalizeApiError(401);
  };
  checkSession();
  await client
    .invalidateQueries({ queryKey: inventoryKey, refetchType: 'none' })
    .catch(() => undefined);
  checkSession();

  const historyFilter = {
    pageIndex: 1,
    pageSize: 10,
    productId: request.productId,
    transactionType: 'ADJUSTMENT',
  };

  const binContents = await freshQueryRead(
    client,
    inventoryQueries.contents(request.binId).queryKey,
    signal => inventoryReadApi.contents(request.binId, signal),
    isCurrent,
  );
  const historyPage = await freshQueryRead(
    client,
    inventoryQueries.history(historyFilter).queryKey,
    signal => inventoryReadApi.history(historyFilter, signal),
    isCurrent,
  );
  const summary = await freshQueryRead(
    client,
    inventoryQueries.summary().queryKey,
    signal => inventoryReadApi.summary(signal),
    isCurrent,
  );
  checkSession();

  const targetLot = (request.lotNumber || '').trim();
  const matchingRows = binContents.items.filter(
    row =>
      row.productId.toLowerCase() === request.productId.toLowerCase() &&
      (row.lotNumber || '').trim() === targetLot,
  );
  const observedLotQuantity = matchingRows.reduce((sum, row) => sum + row.quantity, 0);

  const matchingAdjustments = historyPage.items.filter(item => {
    const sameProduct = item.productId.toLowerCase() === request.productId.toLowerCase();
    const sameDelta = item.quantityChanged === request.adjustmentQuantity;
    const sameReason = item.reasonCode.trim() === request.reasonCode.trim();
    const binCode = binContents.binCode;
    const sameBin =
      !binCode ||
      item.sourceBinCode === binCode ||
      item.destinationBinCode === binCode;
    return item.transactionType === 'ADJUSTMENT' && sameProduct && sameDelta && sameReason && sameBin;
  });

  return {
    observedAt: new Date().toISOString(),
    binContents,
    matchingRows,
    observedLotQuantity,
    previousBinQuantity: snapshot?.previousBinQuantity,
    previousBinOccupancy: snapshot?.previousBinOccupancy,
    currentBinOccupancy: binContents.currentOccupancy,
    binMaxCapacity: binContents.maxCapacity,
    recentAdjustments: historyPage.items,
    matchingAdjustments,
    summary,
    isObservationalOnly: true,
  };
}

// Module-level synchronous flight guard per session hash prevents concurrent submissions
// across multiple callers or rapid double-clicks within the same session.
const activeInFlightSessions = new Set<string>();

export function createStockAdjustmentOperation(client: QueryClient) {
  const owner = sessionStore.get();
  const sessionHash =
    owner && canAdjustStock(owner.role) && owner.token ? sha256Hex(owner.token) : undefined;
  const storageKey = sessionHash ? getJournalStorageKey(sessionHash) : undefined;

  let state: StockAdjustmentOperationState = { phase: 'ready' };
  let inFlight = false;
  const listeners = new Set<() => void>();

  const set = (next: StockAdjustmentOperationState) => {
    state = next;
    listeners.forEach(listener => listener());
  };

  const checkOwner = () => {
    const current = sessionStore.get();
    if (!owner || current !== owner || !sessionHash || !storageKey) {
      throw normalizeApiError(401);
    }
    if (!canAdjustStock(owner.role)) {
      throw normalizeApiError(403);
    }
  };

  const rehydrateFromStorage = (): StockAdjustmentOperationState => {
    if (!owner || owner !== sessionStore.get() || !canAdjustStock(owner.role) || !sessionHash || !storageKey) {
      return { phase: 'ready' };
    }
    if (inFlight || activeInFlightSessions.has(sessionHash)) {
      return state.phase === 'pending' ? state : { ...state, phase: 'pending' };
    }
    try {
      if (typeof globalThis.sessionStorage === 'undefined') {
        return { phase: 'ready' };
      }
      const raw = globalThis.sessionStorage.getItem(storageKey);
      if (raw === null) {
        return { phase: 'ready' };
      }
      const journal = parseJournalEntry(raw, sessionHash);
      if (journal.status === 'pending' || journal.status === 'uncertain') {
        let uncertainJournal = journal;
        let storageWarning = false;
        if (journal.status === 'pending') {
          uncertainJournal = {
            ...journal,
            status: 'uncertain',
            updatedAt: new Date().toISOString(),
          };
          try {
            writeAndVerifyJournal(storageKey, uncertainJournal);
          } catch {
            storageWarning = true;
          }
        }
        return {
          phase: 'uncertain',
          request: uncertainJournal.request,
          journal: uncertainJournal,
          snapshot: uncertainJournal.snapshot,
          error: state.phase === 'uncertain' ? state.error : undefined,
          reconciled: state.phase === 'uncertain' ? Boolean(state.reconciled) : false,
          reconciliation: state.phase === 'uncertain' ? state.reconciliation : undefined,
          reconcileError: state.phase === 'uncertain' ? state.reconcileError : undefined,
          storageWarning,
        };
      }
      // A previously succeeded journal does not lock new adjustments.
      return {
        phase: state.phase === 'succeeded' ? 'succeeded' : 'ready',
        request: journal.request,
        journal,
        snapshot: journal.snapshot,
        refreshWarning: state.refreshWarning,
        refreshError: state.refreshError,
      };
    } catch {
      return {
        phase: 'rejected',
        error: storageError(),
        storageLocked: true,
      };
    }
  };

  state = rehydrateFromStorage();

  const mutation = new MutationObserver(client, {
    mutationKey: [...inventoryKey, 'adjust-stock'],
    mutationFn: (payload: { request: AdjustStockRequest; trackingMode?: number }) =>
      stockAdjustmentApi.adjustStock(payload.request, undefined, payload.trackingMode),
    retry: false,
    networkMode: 'always',
    gcTime: 0,
  });

  return {
    getState: () => state,
    getStorageKey: () => storageKey,
    getSessionHash: () => sessionHash,
    isLocked: () =>
      inFlight ||
      (sessionHash !== undefined && activeInFlightSessions.has(sessionHash)) ||
      state.phase === 'pending' ||
      state.phase === 'uncertain' ||
      Boolean(state.storageLocked),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    rehydrate(): StockAdjustmentOperationState {
      const next = rehydrateFromStorage();
      set(next);
      return next;
    },
    clearResolved(): void {
      if (
        inFlight ||
        (sessionHash !== undefined && activeInFlightSessions.has(sessionHash)) ||
        state.phase === 'pending' ||
        state.phase === 'uncertain' ||
        state.storageLocked
      ) {
        return;
      }
      set({
        phase: 'ready',
        journal: state.journal,
      });
    },
    async submit(
      value: AdjustStockRequest,
      options?: SubmitStockAdjustmentOptions,
    ): Promise<StockAdjustmentOperationState> {
      checkOwner();

      // Synchronous double-click / concurrent submission guard.
      if (inFlight || activeInFlightSessions.has(sessionHash!)) {
        throw normalizeApiError(409, { code: 'FE_ADJUST_IN_FLIGHT' });
      }
      if (state.storageLocked) {
        throw storageError();
      }
      if (state.phase === 'pending' || state.phase === 'uncertain') {
        throw normalizeApiError(409, { code: 'FE_ADJUST_LOCKED' });
      }

      // Check persisted journal before allowing submission in case storage holds an unresolved entry.
      try {
        if (typeof globalThis.sessionStorage === 'undefined') {
          throw new Error('sessionStorage unavailable');
        }
        const existingRaw = globalThis.sessionStorage.getItem(storageKey!);
        if (existingRaw !== null) {
          const existing = parseJournalEntry(existingRaw, sessionHash!);
          if (existing.status === 'pending' || existing.status === 'uncertain') {
            set({
              phase: 'uncertain',
              request: existing.request,
              journal: { ...existing, status: 'uncertain' },
              snapshot: existing.snapshot,
              reconciled: false,
            });
            throw normalizeApiError(409, { code: 'FE_ADJUST_LOCKED' });
          }
        }
      } catch (err) {
        if ((err as ApiError)?.code === 'FE_ADJUST_LOCKED') throw err;
        set({
          phase: 'rejected',
          error: storageError(),
          storageLocked: editingOrCorrupt(storageKey!),
        });
        return state;
      }

      // Validate payload and Serial trackingMode blocking before writing pending journal.
      const request = adjustStockRequest(value, options?.productTrackingMode);

      inFlight = true;
      activeInFlightSessions.add(sessionHash!);

      const now = new Date().toISOString();
      const pendingJournal: StockAdjustmentJournalEntry = {
        version: 1,
        status: 'pending',
        sessionHash: sessionHash!,
        request,
        createdAt: now,
        updatedAt: now,
        ...(options?.snapshot ? { snapshot: options.snapshot } : {}),
      };

      // Requirement 1 & 2: Write pending journal and verify read-back BEFORE dispatching POST.
      try {
        writeAndVerifyJournal(storageKey!, pendingJournal);
      } catch (err) {
        inFlight = false;
        activeInFlightSessions.delete(sessionHash!);
        set({
          phase: 'rejected',
          request,
          snapshot: options?.snapshot,
          error: err as ApiError,
        });
        return state;
      }

      set({
        phase: 'pending',
        request,
        journal: pendingJournal,
        snapshot: options?.snapshot,
      });

      try {
        await mutation.mutate({
          request,
          trackingMode: options?.productTrackingMode,
        });
      } catch (caught) {
        inFlight = false;
        activeInFlightSessions.delete(sessionHash!);
        if (owner !== sessionStore.get()) return state;

        const error = (
          caught && typeof caught === 'object' && 'message' in caught
            ? caught
            : normalizeApiError(undefined)
        ) as ApiError;

        if (isDefiniteRejection(error)) {
          // Requirement 4: Definite 4xx rejection did not commit; clear pending journal and unlock for retry.
          let storageWarning = false;
          try {
            globalThis.sessionStorage.removeItem(storageKey!);
          } catch {
            storageWarning = true;
          }
          set({
            phase: 'rejected',
            request,
            snapshot: options?.snapshot,
            error,
            storageWarning,
          });
          return state;
        }

        // Requirement 4, 5, 6: Uncertain transport/5xx/contract outcome; transition to 'uncertain' and keep locked.
        const uncertainJournal: StockAdjustmentJournalEntry = {
          ...pendingJournal,
          status: 'uncertain',
          updatedAt: new Date().toISOString(),
        };
        let storageWarning = false;
        try {
          writeAndVerifyJournal(storageKey!, uncertainJournal);
        } catch {
          storageWarning = true;
        }
        set({
          phase: 'uncertain',
          request,
          journal: uncertainJournal,
          snapshot: options?.snapshot,
          error,
          reconciled: false,
          storageWarning,
        });
        return state;
      }

      inFlight = false;
      activeInFlightSessions.delete(sessionHash!);
      if (owner !== sessionStore.get()) return state;

      // Requirement 11: Immediately mark journal as 'succeeded' BEFORE awaiting onSuccess / stock query refresh.
      const succeededJournal: StockAdjustmentJournalEntry = {
        ...pendingJournal,
        status: 'succeeded',
        updatedAt: new Date().toISOString(),
      };
      let storageWarning = false;
      try {
        writeAndVerifyJournal(storageKey!, succeededJournal);
      } catch {
        storageWarning = true;
      }

      set({
        phase: 'succeeded',
        request,
        journal: succeededJournal,
        snapshot: options?.snapshot,
        storageWarning,
        refreshing: true,
        refreshWarning: false,
      });

      let refreshError: unknown;
      try {
        await refreshStockAdjustmentReads(
          client,
          request,
          () => owner === sessionStore.get(),
        );
        if (options?.onSuccess && owner === sessionStore.get()) {
          await options.onSuccess();
        }
      } catch (err) {
        refreshError = err;
      }

      if (owner === sessionStore.get()) {
        set({
          phase: 'succeeded',
          request,
          journal: succeededJournal,
          snapshot: options?.snapshot,
          storageWarning,
          refreshing: false,
          refreshWarning: refreshError !== undefined,
          refreshError,
        });
      }
      return state;
    },
    async reconcile(): Promise<StockAdjustmentReconciliationReport | undefined> {
      checkOwner();
      if (
        !state.request ||
        state.phase === 'pending' ||
        state.phase === 'ready' ||
        state.reconciling
      ) {
        return undefined;
      }
      const previous = state;
      set({
        ...previous,
        reconciling: true,
        reconciled: false,
        reconcileError: undefined,
      });
      try {
        const report = await reconcileStockAdjustmentReads(
          client,
          previous.request!,
          previous.snapshot,
          () => owner === sessionStore.get(),
        );
        if (owner === sessionStore.get()) {
          set({
            ...previous,
            reconciling: false,
            reconciled: true,
            reconciliation: report,
            reconcileError: undefined,
          });
        }
        return report;
      } catch (err) {
        if (owner === sessionStore.get()) {
          set({
            ...previous,
            reconciling: false,
            reconciled: false,
            reconcileError: err as ApiError,
          });
        }
        return undefined;
      }
    },
    acknowledge(operatorConfirmed = false): boolean {
      checkOwner();
      if (state.storageLocked) {
        throw storageError();
      }
      if (state.phase === 'pending' || state.reconciling || state.refreshing) {
        throw normalizeApiError(409, { code: 'FE_ADJUST_LOCKED' });
      }
      if (state.phase === 'uncertain' && (!state.reconciled || !operatorConfirmed)) {
        throw normalizeApiError(409, { code: 'FE_ADJUST_RECONCILE_REQUIRED' });
      }
      try {
        if (!storageKey || typeof globalThis.sessionStorage === 'undefined') {
          throw storageError();
        }
        globalThis.sessionStorage.removeItem(storageKey);
        if (globalThis.sessionStorage.getItem(storageKey) !== null) {
          throw storageError();
        }
      } catch {
        set({ ...state, storageWarning: true });
        return false;
      }
      set({ phase: 'ready' });
      return true;
    },
  };
}

function editingOrCorrupt(storageKey: string): boolean {
  try {
    return typeof globalThis.sessionStorage !== 'undefined' && globalThis.sessionStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

const operations = new WeakMap<
  QueryClient,
  {
    ownerToken: string | undefined;
    ownerRole: string | undefined;
    operation: ReturnType<typeof createStockAdjustmentOperation>;
  }
>();

export function getStockAdjustmentOperation(client: QueryClient) {
  const owner = sessionStore.get();
  const saved = operations.get(client);
  if (
    saved &&
    saved.ownerToken === owner?.token &&
    saved.ownerRole === owner?.role
  ) {
    return saved.operation;
  }
  const operation = createStockAdjustmentOperation(client);
  operations.set(client, {
    ownerToken: owner?.token,
    ownerRole: owner?.role,
    operation,
  });
  return operation;
}
