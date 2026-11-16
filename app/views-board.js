// The board surface, loaded on first load: loading/error states, one bounty
// card, the board shell, and the filter + sort + page logic. Detail views
// (bounty, leaderboard, profile) live in views-detail.js and load lazily on
// their routes, so the first load stays small.

import { esc, money, num, timeLeft, takesEntries, pot } from './format.js';

export const BOARD_PAGE_SIZE = 8;

/** Loading and error states shared by every route. */
export const loadingHtml = '<p class="loading">Loading live data from make.fun…</p>';
export function errorHtml(err) {
  const msg = err && err.status === 404 ? 'Not found on make.fun.' : 'Could not load live data from make.fun. Check your connection and try again.';
  return `<p class="error">${esc(msg)}</p><p><a href="#/">Back to the board</a></p>`;
}

/** One bounty card: pot, fee, time left and entries all on one line. */
export function bountyCard(b) {
  const open = takesEntries(b);
  const summary = (b.summary || b.description || '').replace(/\s+/g, ' ').slice(0, 160);
  return `<li class="card">
    <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
    <span class="pot">${esc(pot(b))}</span>
    <p class="summary">${esc(summary)}</p>
    <div class="meta">
      <span class="chip ${open ? 'open' : 'closed'}">${open ? 'Open · takes entries' : 'Closed to entries'}</span>
      ${b.category ? `<span class="chip">${esc(b.category)}</span>` : ''}
      <span class="${b.entryFeeUsd ? 'fee' : ''}">${b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee` : 'Free entry'}</span>
      <span class="left ${open ? '' : 'ended'}" data-deadline="${esc(b.deadline)}">${esc(timeLeft(b.deadline))}</span>
      <span class="entries">${num(b.submissionCount)} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
    </div>
  </li>`;
}

/** The board shell: toolbar (search + sort) above the list that updates in place. */
export function boardShell(total) {
  return `<h1>Live bounties</h1>
  <p class="lede">${num(total)} ${total === 1 ? 'bounty' : 'bounties'} open on make.fun right now — pot, entry fee, time left and entries at a glance.</p>
  <div class="toolbar">
    <label class="visually-hidden" for="board-filter">Filter bounties</label>
    <input id="board-filter" type="search" placeholder="Filter by title or category…" autocomplete="off" spellcheck="false">
    <label class="visually-hidden" for="board-sort">Sort bounties</label>
    <select id="board-sort">
      <option value="deadline">Ending soonest</option>
      <option value="pot">Largest pot</option>
      <option value="entries">Most entries</option>
      <option value="title">Title A–Z</option>
    </select>
    <span class="count" id="board-count"></span>
  </div>
  <ul class="cards" id="board-list"></ul>
  <div class="pager" id="board-pager"></div>`;
}

/** Filter + sort + page the board items; returns the list and pager HTML. */
export function boardPage(items, query, sort, page) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((b) => `${b.title} ${b.category ?? ''} ${b.slug}`.toLowerCase().includes(q))
    : items.slice();
  const by = {
    // Ending soonest, but a bounty past its deadline sorts after live ones.
    deadline: (a, b) => (new Date(a.deadline) - Date.now() <= 0) - (new Date(b.deadline) - Date.now() <= 0) || new Date(a.deadline) - new Date(b.deadline),
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount),
    entries: (a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0),
    title: (a, b) => String(a.title).localeCompare(String(b.title)),
  };
  filtered.sort(by[sort] ?? by.deadline);
  const pages = Math.max(1, Math.ceil(filtered.length / BOARD_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = filtered.slice((safePage - 1) * BOARD_PAGE_SIZE, safePage * BOARD_PAGE_SIZE);
  const list = slice.length
    ? slice.map(bountyCard).join('')
    : '<li class="empty">No bounties match that filter.</li>';
  const pager = pages > 1
    ? `<button type="button" data-page="${safePage - 1}" ${safePage === 1 ? 'disabled' : ''}>← Newer</button>
       <span class="pageinfo">Page ${safePage} of ${pages}</span>
       <button type="button" data-page="${safePage + 1}" ${safePage === pages ? 'disabled' : ''}>Older →</button>`
    : '';
  return { list, pager, count: `${num(filtered.length)} shown`, page: safePage, pages };
}
