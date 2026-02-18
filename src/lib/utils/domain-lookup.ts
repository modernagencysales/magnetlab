/**
 * Domain Lookup Utility with LRU Cache
 *
 * Used by Next.js middleware to resolve custom domains on every incoming request.
 * The LRU cache prevents a Supabase roundtrip on every page load.
 *
 * Cache: Map-based LRU, 500 max entries, 60-second TTL, caches negative results.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ----- Cache Types & Constants -----

interface CacheEntry {
  /** null for negative (domain not found / not active) results */
  result: { teamId: string; username: string } | null;
  /** Epoch ms when the entry was written */
  timestamp: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 500;

/**
 * Map-based LRU cache.
 * JS Maps iterate in insertion order, so re-inserting a key on access
 * moves it to the "most recently used" end. Eviction deletes from the front.
 */
const cache = new Map<string, CacheEntry>();

// ----- Internal Helpers -----

/** Touch a key so it moves to the most-recently-used position. */
function touchKey(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
}

/**
 * Evict entries to keep the cache within MAX_CACHE_SIZE.
 * First pass: remove stale entries (older than TTL).
 * Second pass (if still over limit): remove oldest entries (front of Map).
 */
function evictIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;

  const now = Date.now();

  // Pass 1 — remove expired entries
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }

  // Pass 2 — if still over limit, evict oldest (front of iteration order)
  if (cache.size > MAX_CACHE_SIZE) {
    const excess = cache.size - MAX_CACHE_SIZE;
    let removed = 0;
    for (const key of cache.keys()) {
      if (removed >= excess) break;
      cache.delete(key);
      removed++;
    }
  }
}

// ----- Public API -----

/**
 * Look up a custom domain and return the owning team + username.
 *
 * 1. Check cache first; return immediately if fresh.
 * 2. On cache miss: query `team_domains` -> `teams` -> `users`.
 * 3. Cache the result (positive or negative).
 * 4. Only return non-null if the domain status is 'active'.
 */
export async function lookupCustomDomain(
  hostname: string
): Promise<{ teamId: string; username: string } | null> {
  const normalised = hostname.toLowerCase();

  // --- Cache hit? ---
  const cached = cache.get(normalised);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Move to most-recently-used position
    touchKey(normalised, cached);
    return cached.result;
  }

  // --- Cache miss — query DB ---
  const supabase = createSupabaseAdminClient();

  // Step 1: Find the domain row
  const { data: domainRow } = await supabase
    .from('team_domains')
    .select('team_id, status')
    .eq('domain', normalised)
    .single();

  if (!domainRow) {
    // Negative cache — avoid repeated DB hits for unknown domains
    cache.set(normalised, { result: null, timestamp: Date.now() });
    evictIfNeeded();
    return null;
  }

  // If domain exists but is not active, cache as negative
  if (domainRow.status !== 'active') {
    cache.set(normalised, { result: null, timestamp: Date.now() });
    evictIfNeeded();
    return null;
  }

  // Step 2: Get the team's owner_id
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', domainRow.team_id)
    .single();

  if (!team) {
    cache.set(normalised, { result: null, timestamp: Date.now() });
    evictIfNeeded();
    return null;
  }

  // Step 3: Get the owner's username
  const { data: user } = await supabase
    .from('users')
    .select('username')
    .eq('id', team.owner_id)
    .single();

  if (!user?.username) {
    cache.set(normalised, { result: null, timestamp: Date.now() });
    evictIfNeeded();
    return null;
  }

  // Positive result — cache and return
  const result = { teamId: domainRow.team_id, username: user.username };
  cache.set(normalised, { result, timestamp: Date.now() });
  evictIfNeeded();

  return result;
}

/**
 * Bust the cache for a specific domain.
 * Call this when domain settings change (add, verify, delete).
 */
export function invalidateDomainCache(hostname: string): void {
  cache.delete(hostname.toLowerCase());
}
