# make.fun bounty board

[![make.fun bounty](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01)
[![make.fun rank](https://make.fun/badge/makefun-frontend-01/trungngo69/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01)
[![make.fun reward](https://make.fun/badge/makefun-frontend-01/trungngo69/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01)

A fast, read-only frontend for [make.fun](https://make.fun) — built for the
[makefun-frontend-01 bounty](https://make.fun/bounty/makefun-frontend-01). Static files only,
no build step, no framework, no sign-in: it reads make.fun's public API and nothing else.

## What it shows

- **Bounty board** (`#/`): every live bounty with its live pot, entry fee, time left and
  entries — filter by text, sort by deadline / pot / entries, paged 8 at a time.
- **Bounty page** (`#/bounty/<slug>`): summary, live-pot rewards table, dates, status
  (a bounty past its deadline is shown as closed to entries even if its status still reads
  open), and the full description and rules.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): the bounty's ranked entries, paged 25
  at a time, with win rates and links to each entrant's profile.
- **Public profile** (`#/profile/<handle>`): avatar, bio, record (entered / placed / wins /
  prize money) and every entry, with place, score and prize.

## Why it is fast

- **ETag revalidation**: every API answer is cached in memory with its ETag; a repeat
  within the same minute sends `If-None-Match` and a `304` reuses the cached body.
- **Few requests per view**: one request for the board, one per bounty page, one per
  leaderboard (all rows), one per profile — filtering, sorting and paging never refetch.
- **Tiny first load**: a handful of small ES modules plus one stylesheet, system fonts only.
- **No wasted rebuilds**: the header and footer never re-render, and the countdowns tick
  in place every 30 seconds without a refetch.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Node 22 or later. `serve.ts` is a dev-only static server for `app/`.
