import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Firestore-backed array state, with the same shape and setter signature as
 * useState.
 *
 * WHY IT LOOKS LIKE useState
 *
 * The application kept fourteen slices of state in localStorage — thirteen
 * arrays and a settings object — written back by a useEffect each. So data was
 * per-browser: a second device saw nothing, a cleared cache lost everything,
 * and nothing server-side could read it (which is why a scheduled reminder was
 * impossible: an SPA only emits events while a tab is open).
 *
 * The forty-odd mutation functions in AppContext are all written as array
 * updates — `setLeads(prev => [newLead, ...prev])`. Rewriting each one into
 * per-document Firestore writes would have meant touching every one of them,
 * which is a lot of places to get subtly wrong.
 *
 * So this hook keeps the array-and-setter interface and does the persistence
 * underneath: it diffs the array you set against the one before it and issues
 * exactly the document writes that difference implies. Existing mutation code
 * is unchanged.
 *
 * localStorage stays, but demoted to an explicit CACHE: it paints the first
 * frame instantly and keeps the app readable if Firestore is unreachable. It is
 * no longer the source of truth, and it no longer silently pretends success.
 */

export type SyncStatus =
  /** Rendering from the local cache; no live connection yet. */
  | 'cache'
  /** Subscribed to Firestore; this is authoritative. */
  | 'live'
  /** Writing the initial seed for a new organisation. */
  | 'seeding'
  /** Firestore unreachable or denied; local only, changes are NOT saved remotely. */
  | 'offline';

interface BaseOptions {
  organizationId: string;
  /** Only subscribe once identity is resolved — an unauthenticated read is denied. */
  enabled: boolean;
  /** localStorage key for the cache. */
  cacheKey: string;
}

interface CollectionOptions<T> extends BaseOptions {
  /** Seed an empty collection with these records on first run. */
  seed?: T[];
  /**
   * How to derive a record's document id.
   *
   * Defaults to `row.id`, which is what every module uses — except staff
   * records, whose primary key is `uid`. That matters beyond tidiness: the
   * security rules match /users/{userId} against the caller's own uid, so the
   * document id has to BE the uid for a user to be able to edit their own
   * profile.
   */
  getId?: (row: T) => string;
}

interface DocOptions<T> extends BaseOptions {
  seed: T;
}

const BATCH_LIMIT = 450; // Firestore allows 500 operations; leave headroom.

function readCache<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or unavailable quota must not break the app — the cache is a
    // convenience, not the record.
  }
}

/** Stable comparison for "has this document actually changed". */
function sameDoc(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface CollectionDiff<T> {
  /** Documents to write: new ones, and existing ones whose contents changed. */
  upserts: T[];
  /** Document ids present before and absent after. */
  removals: string[];
}

/**
 * Work out the document writes implied by replacing one array with another.
 *
 * Pure and exported so it can be tested directly — it is the part of this hook
 * that would quietly corrupt data if it were wrong, by writing documents that
 * did not change or, worse, deleting ones that did not go away.
 */
export function computeDiff<T>(previous: T[], next: T[], getId: (row: T) => string): CollectionDiff<T> {
  const before = new Map(previous.map((r) => [getId(r), r]));
  const after = new Map(next.map((r) => [getId(r), r]));

  const upserts: T[] = [];
  for (const [id, row] of after) {
    const old = before.get(id);
    if (!old || !sameDoc(old, row)) upserts.push(row);
  }

  const removals: string[] = [];
  for (const id of before.keys()) {
    if (!after.has(id)) removals.push(id);
  }

  return { upserts, removals };
}

/**
 * Firestore rejects `undefined` outright: one such field aborts the whole
 * batch with "Unsupported field value: undefined", and every other document in
 * it is lost with it.
 *
 * That is exactly what happened here. `logActivity` leaves `oldValue`
 * undefined for a create, and `recordDispatchOutcome` leaves `errorMessage`
 * undefined on success — both perfectly reasonable in TypeScript, both fatal
 * to a write. The activityLogs and automationLogs slices went permanently
 * offline, and because the dispatch log is what records an automation's
 * outcome, live dispatches were happening and then vanishing without a trace.
 *
 * An absent key and an explicitly-undefined key mean the same thing, so the
 * keys are dropped rather than written as null — null would claim the field
 * exists and is empty, which is a different statement.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export function useSyncedCollection<T extends object>(
  collectionName: string,
  options: CollectionOptions<T>
): [T[], Dispatch<SetStateAction<T[]>>, SyncStatus] {
  const { organizationId, enabled, cacheKey, seed } = options;
  const getId = options.getId ?? ((row: T) => (row as { id?: string }).id ?? '');

  const [items, setItemsLocal] = useState<T[]>(() => readCache<T>(cacheKey) ?? seed ?? []);
  const [status, setStatus] = useState<SyncStatus>('cache');

  // Diffing needs the array as it is right now, not as it was when a callback
  // was created.
  const itemsRef = useRef<T[]>(items);
  itemsRef.current = items;

  const seededRef = useRef(false);
  const statusRef = useRef<SyncStatus>(status);
  statusRef.current = status;

  // Keep the cache warm on every change, whatever the source.
  useEffect(() => {
    writeCache(cacheKey, items);
  }, [cacheKey, items]);

  /* ---------------------------------------------------------------- *
   * Remote → local
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!enabled || !organizationId) {
      setStatus('offline');
      return;
    }

    const q = query(collection(db, collectionName), where('organizationId', '==', organizationId));

    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty && seed && seed.length > 0 && !seededRef.current) {
          // A brand-new organisation. Write the starter records once, then let
          // the listener deliver them back.
          seededRef.current = true;
          setStatus('seeding');
          try {
            for (let i = 0; i < seed.length; i += BATCH_LIMIT) {
              const batch = writeBatch(db);
              for (const row of seed.slice(i, i + BATCH_LIMIT)) {
                batch.set(doc(db, collectionName, getId(row)), stripUndefined({ ...row, organizationId }));
              }
              await batch.commit();
            }
          } catch (err) {
            console.warn(`[sync] Could not seed ${collectionName}:`, err);
            setStatus('offline');
          }
          return;
        }

        seededRef.current = true;
        // Applied with the plain setter, NOT the write-through one — otherwise
        // every remote update would be diffed and written straight back, which
        // is an infinite loop.
        setItemsLocal(snap.docs.map((d) => d.data() as T));
        setStatus('live');
      },
      (err) => {
        // Permission denied, offline, rules not deployed. The app keeps working
        // from cache, but the status says plainly that writes are local only —
        // the previous code degraded to localStorage and looked like success.
        console.warn(`[sync] ${collectionName} is offline:`, err.message);
        setStatus('offline');
      }
    );

    return unsubscribe;
    // `seed` is intentionally not a dependency: it is a constant starter set,
    // and including it would resubscribe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, organizationId, enabled]);

  /* ---------------------------------------------------------------- *
   * Local → remote
   * ---------------------------------------------------------------- */
  const writeDiff = useCallback(
    async (previous: T[], next: T[]) => {
      if (!enabled || !organizationId) return; // offline: local only
      if (statusRef.current === 'offline') return;

      const { upserts, removals } = computeDiff(previous, next, getId);
      if (upserts.length === 0 && removals.length === 0) return;

      try {
        const ops: Array<() => void> = [];
        const batch = writeBatch(db);
        let count = 0;

        for (const row of upserts) {
          // organizationId is stamped on every write: the security rules
          // require an incoming document to carry the caller's own org, which
          // is what stops a record being planted in another tenant.
          batch.set(doc(db, collectionName, getId(row)), stripUndefined({ ...row, organizationId }));
          count++;
        }
        for (const id of removals) {
          batch.delete(doc(db, collectionName, id));
          count++;
        }
        void ops;

        if (count <= BATCH_LIMIT) {
          await batch.commit();
        } else {
          // Rare, but a CSV import can exceed the batch limit.
          for (let i = 0; i < upserts.length; i += BATCH_LIMIT) {
            const b = writeBatch(db);
            for (const row of upserts.slice(i, i + BATCH_LIMIT)) {
              b.set(doc(db, collectionName, getId(row)), { ...row, organizationId });
            }
            await b.commit();
          }
          for (const id of removals) {
            await deleteDoc(doc(db, collectionName, id));
          }
        }
      } catch (err) {
        console.error(`[sync] Write to ${collectionName} failed:`, err);
        setStatus('offline');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionName, organizationId, enabled]
  );

  /**
   * The setter callers use. Same signature as useState's, so no mutation
   * function had to change.
   */
  const setItems = useCallback<Dispatch<SetStateAction<T[]>>>(
    (updater) => {
      const previous = itemsRef.current;
      const next =
        typeof updater === 'function' ? (updater as (p: T[]) => T[])(previous) : updater;

      // Optimistic: paint immediately, then persist. The listener reconciles.
      itemsRef.current = next;
      setItemsLocal(next);
      void writeDiff(previous, next);
    },
    [writeDiff]
  );

  return [items, setItems, status];
}

/* -------------------------------------------------------------------- *
 * Single-document variant, for the organisation settings object.
 * -------------------------------------------------------------------- */

export function useSyncedDoc<T extends object>(
  collectionName: string,
  docId: string,
  options: DocOptions<T>
): [T, Dispatch<SetStateAction<T>>, SyncStatus] {
  const { organizationId, enabled, cacheKey, seed } = options;

  const [value, setValueLocal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? ({ ...seed, ...JSON.parse(raw) } as T) : seed;
    } catch {
      return seed;
    }
  });
  const [status, setStatus] = useState<SyncStatus>('cache');
  const valueRef = useRef<T>(value);
  valueRef.current = value;

  useEffect(() => {
    writeCache(cacheKey, value);
  }, [cacheKey, value]);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setStatus('offline');
      return;
    }
    const ref = doc(db, collectionName, docId);
    return onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          try {
            const batch = writeBatch(db);
            batch.set(ref, stripUndefined({ ...seed, organizationId }));
            await batch.commit();
          } catch (err) {
            // Seeding settings needs business_admin. A staff user signing in
            // first is not an outage — it means the document does not exist
            // yet and we are showing defaults from the local cache.
            console.warn(`[sync] Could not seed ${collectionName}/${docId}:`, err);
            setStatus('cache');
          }
          return;
        }
        setValueLocal({ ...seed, ...(snap.data() as T) });
        setStatus('live');
      },
      (err) => {
        console.warn(`[sync] ${collectionName}/${docId} is offline:`, err.message);
        setStatus('offline');
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, docId, organizationId, enabled]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (updater) => {
      const previous = valueRef.current;
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(previous) : updater;
      valueRef.current = next;
      setValueLocal(next);

      if (!enabled || !organizationId) return;
      const ref = doc(db, collectionName, docId);
      const batch = writeBatch(db);
      batch.set(ref, stripUndefined({ ...next, organizationId }), { merge: true });
      batch.commit().catch((err) => {
        console.error(`[sync] Write to ${collectionName}/${docId} failed:`, err);
        setStatus('offline');
      });
    },
    [collectionName, docId, organizationId, enabled]
  );

  return [value, setValue, status];
}
