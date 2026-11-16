// The detail surfaces — one bounty, its leaderboard, and a public profile —
// loaded lazily by main.js only when their route renders, so they never
// weigh on the board's first load. Loading and error states stay in
// views-board.js, which is always loaded.

import { esc, money, num, date, timeLeft, takesEntries, pot, winRate } from './format.js';

export const LEADERBOARD_PAGE_SIZE = 25;

/** A tiny markdown reader for bounty descriptions: headings, bold, lists. */
export function markdown(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (line.startsWith('# ')) { closeList(); html += `<h2>${inline(line.slice(2))}</h2>`; }
    else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else if (line.trim() === '') { closeList(); }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

function inline(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** One bounty: summary, facts, rewards table with the live pot, dates, rules. */
export function bountyPage(b) {
  const open = takesEntries(b);
  const status = b.status === 'resolved' ? 'Resolved' : open ? 'Open — takes entries' : 'Open — entries closed (past deadline)';
  const rows = (b.rewardsNow ?? []).map((r) => `<tr>
      <td class="rank">#${num(r.place)}</td>
      <td class="num">${money(r.baseUsd)}</td>
      <td class="num">${money(r.feeShareUsd)}</td>
      <td class="num"><strong>${money(r.amountUsd)}</strong></td>
    </tr>`).join('');
  const rewardsTable = rows
    ? `<h2>Rewards — live pot ${esc(pot(b))}</h2>
       <table><thead><tr><th>Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead><tbody>${rows}</tbody></table>`
    : '';
  return `<p class="crumbs"><a href="#/">← All bounties</a></p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <p><span class="chip ${open ? 'open' : 'closed'}">${esc(status)}</span>
  ${b.category ? ` <span class="chip">${esc(b.category)}</span>` : ''}
  ${b.sponsor ? ` <span class="chip">by ${esc(b.sponsor.name)}</span>` : ''}</p>
  <div class="facts">
    <div class="fact"><div class="k">Live pot</div><div class="v">${esc(pot(b))}</div><div class="s">base ${money(b.rewardAmount)} + entry fees</div></div>
    <div class="fact"><div class="k">Entry fee</div><div class="v">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</div><div class="s">${b.entryFeePayers ? `${num(b.entryFeePayers)} paid in` : 'no fee to enter'}</div></div>
    <div class="fact"><div class="k">Time left</div><div class="v" data-deadline="${esc(b.deadline)}">${esc(timeLeft(b.deadline))}</div><div class="s">${esc(date(b.deadline))}</div></div>
    <div class="fact"><div class="k">Entries</div><div class="v">${num(b.submissionCount)}</div><div class="s">${b.publishedAt ? `published ${esc(date(b.publishedAt))}` : ''}</div></div>
  </div>
  <div class="actions">
    <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard →</a>
    <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun ↗</a>
  </div>
  ${rewardsTable}
  <h2>Description &amp; rules</h2>
  <div class="markdown">${markdown(b.description)}</div>`;
}

/** One leaderboard cell: win rates read as percents, sizes as KB. */
function leaderboardCell(col, entry) {
  const v = entry.values?.[col.key];
  const d = entry.display?.[col.key];
  if (v == null && d == null) return '—';
  if (col.key === 'judge' || col.key === 'judge_low' || col.key === 'judge_high') return winRate(v ?? d);
  if (col.key === 'bytes') return `${(Number(v ?? d) / 1024).toFixed(1)}&nbsp;KB`;
  return esc(d ?? v);
}

/** A bounty's leaderboard: ranked entries, paged 25 at a time. */
export function leaderboardPage(slug, data, page) {
  const entries = data.entries ?? [];
  const cols = (data.columns ?? []).filter((c) => !c.hidden);
  const pages = Math.max(1, Math.ceil(entries.length / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = entries.slice((safePage - 1) * LEADERBOARD_PAGE_SIZE, safePage * LEADERBOARD_PAGE_SIZE);
  const rows = slice.map((e) => `<tr>
    <td class="rank">#${num(e.rank)}</td>
    <td><a href="#/profile/${encodeURIComponent(e.handle ?? '')}">${esc(e.handle ?? '—')}</a>${e.house ? ' <span class="chip">house</span>' : ''}${e.baseline ? ' <span class="chip">baseline</span>' : ''}</td>
    <td>${esc(e.title ?? '')}</td>
    ${cols.map((c) => `<td class="num">${leaderboardCell(c, e)}</td>`).join('')}
  </tr>`).join('');
  const pager = pages > 1
    ? `<div class="pager"><button type="button" data-page="${safePage - 1}" ${safePage === 1 ? 'disabled' : ''}>← Prev</button>
       <span class="pageinfo">Page ${safePage} of ${pages} · ${num(entries.length)} entries</span>
       <button type="button" data-page="${safePage + 1}" ${safePage === pages ? 'disabled' : ''}>Next →</button></div>`
    : `<p class="lede">${num(entries.length)} ${entries.length === 1 ? 'entry' : 'entries'} ranked.</p>`;
  return `<p class="crumbs"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(data.competition?.title ?? slug)}</a> · <a href="#/">All bounties</a></p>
  <h1>${esc(data.title ?? 'Leaderboard')}</h1>
  <p class="lede">${esc(data.competition?.title ?? '')} · ${esc(data.phase?.title ?? '')} phase · ranked by ${esc(data.columns?.[0]?.title ?? 'score')}${data.metrics_withheld ? ' · scores hidden until results publish' : ''}</p>
  <table><thead><tr><th>Rank</th><th>Entrant</th><th>Entry</th>${cols.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead>
  <tbody>${rows || '<tr><td colspan="6" class="empty">No entries ranked yet.</td></tr>'}</tbody></table>
  ${pager}`;
}

/** A public profile: avatar, bio, record, and every solution entered. */
export function profilePage(p) {
  const rec = p.record ?? {};
  const avatar = p.avatar?.url ?? p.image ?? '';
  const letter = (p.display_name ?? p.handle ?? '?').slice(0, 1).toUpperCase();
  const solutions = (p.solutions ?? []).map((s) => {
    const c = s.competition ?? {};
    const place = s.placement ? `#${num(s.placement)}` : '—';
    const score = s.score?.value != null ? winRate(s.score.value) : '—';
    return `<tr>
      <td><a href="#/bounty/${encodeURIComponent(c.slug ?? '')}">${esc(c.title ?? c.slug ?? '')}</a></td>
      <td><span class="chip ${c.status === 'open' ? 'open' : 'closed'}">${esc(c.status ?? '')}</span></td>
      <td class="hide-sm">${esc(date(c.deadline))}</td>
      <td class="num">${place}</td>
      <td class="num">${esc(score)}</td>
      <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
    </tr>`;
  }).join('');
  return `<p class="crumbs"><a href="#/">← All bounties</a></p>
  <div class="profile-head">
    ${avatar
      ? `<img class="avatar" crossorigin="anonymous" src="${esc(apiImageSrc(avatar))}" alt="Avatar of ${esc(p.display_name ?? p.handle)}">`
      : `<span class="avatar-fallback" aria-hidden="true">${esc(letter)}</span>`}
    <div>
      <h1>${esc(p.display_name ?? p.handle)}</h1>
      <p class="lede">@${esc(p.handle)}${p.github_login ? ` · GitHub ${esc(p.github_login)}` : ''}${p.x ? ` · X @${esc(p.x)}` : ''}${p.joined_at ? ` · joined ${esc(date(p.joined_at))}` : ''}</p>
    </div>
  </div>
  ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
  <div class="statgrid">
    <div class="fact"><div class="k">Entered</div><div class="v">${num(rec.competitions_entered)}</div></div>
    <div class="fact"><div class="k">Placed</div><div class="v">${num(rec.competitions_placed)}</div></div>
    <div class="fact"><div class="k">Wins</div><div class="v">${num(rec.competitions_won)}</div></div>
    <div class="fact"><div class="k">Best place</div><div class="v">${rec.best_placement ? `#${num(rec.best_placement)}` : '—'}</div></div>
    <div class="fact"><div class="k">Prize money</div><div class="v">${rec.prize_usd ? money(rec.prize_usd) : '$0'}</div></div>
  </div>
  <h2>Entries (${num((p.solutions ?? []).length)})</h2>
  ${solutions
    ? `<table><thead><tr><th>Bounty</th><th>Status</th><th class="hide-sm">Deadline</th><th class="num">Place</th><th class="num">Score</th><th class="num">Prize</th></tr></thead><tbody>${solutions}</tbody></table>`
    : '<p class="empty">No entries yet.</p>'}
  <p><a href="https://make.fun/u/${encodeURIComponent(p.handle)}">Open @${esc(p.handle)} on make.fun ↗</a></p>`;
}

// Avatar paths from the API are relative (/api/avatars/…); make them absolute.
function apiImageSrc(path) {
  return path.startsWith('http') ? path : `https://make.fun${path}`;
}
