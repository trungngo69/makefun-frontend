// Router for the four surfaces, on hash routes so every view has its own URL:
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/profile/<handle>              an account's public profile
//
// window.__shotReady is false while a route loads and true once its data has
// rendered, so a screenshot script knows when to capture. The header and
// footer never rebuild: only #app changes, and the countdown ticker updates
// the time-left text in place every 30 seconds without a refetch.

import { fetchBounties, fetchBounty, fetchLeaderboard, fetchProfile } from './api.js';
import { timeLeft } from './format.js';
import {
  boardShell, boardPage,
  loadingHtml, errorHtml,
} from './views-board.js';

const app = document.getElementById('app');
const searchForm = document.getElementById('profile-search');
const searchInput = document.getElementById('profile-handle');

// The board's data, kept in memory so filtering and paging never refetch.
const boardState = { items: [], query: '', sort: 'deadline', page: 1 };

/** Refresh every [data-deadline] countdown in place, no rebuild, no fetch. */
function tickCountdowns() {
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const next = timeLeft(el.getAttribute('data-deadline'), now);
    if (el.textContent !== next) el.textContent = next;
  }
}
setInterval(tickCountdowns, 30000);

/** Re-render only the board's list and pager, leaving the toolbar alone. */
function updateBoardList() {
  const list = document.getElementById('board-list');
  const pager = document.getElementById('board-pager');
  const count = document.getElementById('board-count');
  if (!list) return;
  const result = boardPage(boardState.items, boardState.query, boardState.sort, boardState.page);
  boardState.page = result.page;
  list.innerHTML = result.list;
  pager.innerHTML = result.pager;
  count.textContent = result.count;
}

function markNav(route) {
  for (const [id, on] of [['nav-board', route === 'board'], ['nav-this', route === 'bounty'], ['nav-leader', route === 'leaderboard']]) {
    const el = document.getElementById(id);
    if (el) {
      if (on) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }
  }
}

async function renderBoard() {
  markNav('board');
  document.title = 'make.fun — bounty board';
  app.innerHTML = loadingHtml;
  try {
    boardState.items = await fetchBounties();
  } catch (err) {
    app.innerHTML = errorHtml(err);
    return;
  }
  boardState.page = 1;
  app.innerHTML = boardShell(boardState.items.length);
  updateBoardList();
  const filter = document.getElementById('board-filter');
  const sort = document.getElementById('board-sort');
  const pager = document.getElementById('board-pager');
  filter.addEventListener('input', () => { boardState.query = filter.value; boardState.page = 1; updateBoardList(); });
  sort.addEventListener('change', () => { boardState.sort = sort.value; boardState.page = 1; updateBoardList(); });
  pager.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (button && !button.disabled) { boardState.page = Number(button.getAttribute('data-page')); updateBoardList(); }
  });
}

async function renderBounty(slug) {
  markNav('bounty');
  app.innerHTML = loadingHtml;
  try {
    const bounty = await fetchBounty(slug);
    const { bountyPage } = await import('./views-detail.js');
    document.title = `${bounty.title} | make.fun`;
    app.innerHTML = bountyPage(bounty);
  } catch (err) {
    document.title = 'Not found | make.fun';
    app.innerHTML = errorHtml(err);
  }
}

async function renderLeaderboard(slug, page) {
  markNav('leaderboard');
  app.innerHTML = loadingHtml;
  try {
    const data = await fetchLeaderboard(slug);
    const { leaderboardPage } = await import('./views-detail.js');
    document.title = `Leaderboard — ${data.competition?.title ?? slug} | make.fun`;
    app.innerHTML = leaderboardPage(slug, data, page);
    app.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        location.hash = `#/bounty/${encodeURIComponent(slug)}/leaderboard?p=${button.getAttribute('data-page')}`;
      });
    });
  } catch (err) {
    document.title = 'Not found | make.fun';
    app.innerHTML = errorHtml(err);
  }
}

async function renderProfile(handle) {
  markNav('');
  app.innerHTML = loadingHtml;
  try {
    const profile = await fetchProfile(handle);
    const { profilePage } = await import('./views-detail.js');
    document.title = `@${profile.handle} | make.fun`;
    app.innerHTML = profilePage(profile);
  } catch (err) {
    document.title = 'Not found | make.fun';
    app.innerHTML = errorHtml(err);
  }
}

async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const [pathPart, queryPart] = hash.split('?');
  const parts = pathPart.replace(/^#\//, '').split('/');
  const query = new URLSearchParams(queryPart ?? '');
  try {
    if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
      await renderLeaderboard(decodeURIComponent(parts[1]), Number(query.get('p')) || 1);
    } else if (parts[0] === 'bounty' && parts[1]) {
      await renderBounty(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'profile' && parts[1]) {
      await renderProfile(decodeURIComponent(parts[1]));
    } else {
      await renderBoard();
    }
  } finally {
    window.scrollTo(0, 0);
    window.__shotReady = true;
  }
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = searchInput.value.trim();
  if (handle) location.hash = `#/profile/${encodeURIComponent(handle)}`;
});

window.addEventListener('hashchange', render);
render();
