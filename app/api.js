// make.fun public API, read-only GET. Every answer is cached in memory with
// its ETag: a repeat within the same minute revalidates with If-None-Match
// and a 304 reuses the cached body, so a view costs 0 bytes when nothing
// changed. The API answers any origin (CORS); no key, no sign-in, no writes.
export const API = 'https://make.fun/api';

// url -> { etag, body } for this session only.
const cache = new Map();

// Requests actually sent, and 304s served from cache; shown in the footer.
export const netStats = { sent: 0, revalidated: 0, bytes: 0 };

function noteStats() {
  const el = document.getElementById('netstat');
  if (el) {
    el.textContent = `${netStats.sent} request${netStats.sent === 1 ? '' : 's'} · ${netStats.revalidated} revalidated from cache`;
  }
}

/** GET one JSON resource, revalidating with its cached ETag when we have one.
 *  One retry after a short pause: the public API's edge occasionally drops a
 *  response's CORS headers, and a second try lands on a good one. */
export async function fetchJson(path, attempt = 1) {
  const url = API + path;
  const hit = cache.get(url);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fetchJson(path, attempt + 1);
    }
    throw err;
  }
  netStats.sent += 1;
  if (res.status === 304 && hit) {
    netStats.revalidated += 1;
    noteStats();
    return hit.body;
  }
  if (!res.ok) {
    if (attempt < 2 && res.status !== 404) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fetchJson(path, attempt + 1);
    }
    const err = new Error(`make.fun ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) cache.set(url, { etag, body });
  noteStats();
  return body;
}

/** All open bounties, following the list cursor so no page is missed. */
export async function fetchBounties() {
  const items = [];
  let cursor = '';
  for (let page = 0; page < 10; page += 1) {
    const data = await fetchJson(`/competitions?status=open&activity=times&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    items.push(...(data.items ?? []));
    cursor = data.next_cursor ?? '';
    if (!cursor) break;
  }
  return items;
}

/** One bounty, by slug, with its rewards table and live pot. */
export function fetchBounty(slug) {
  return fetchJson(`/competitions/${encodeURIComponent(slug)}`);
}

/** A bounty's leaderboard, all rows (the default page is only the first 10). */
export function fetchLeaderboard(slug) {
  return fetchJson(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=all`);
}

/** An account's public profile, by handle. */
export function fetchProfile(handle) {
  return fetchJson(`/profiles/${encodeURIComponent(handle)}`);
}

/** Resolve a possibly relative API image path to an absolute make.fun URL. */
export function apiImage(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://make.fun${path}`;
}
