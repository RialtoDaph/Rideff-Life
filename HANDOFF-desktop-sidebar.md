# Handoff: desktop sidebar + grid (branch `elevenagents-voice`, PR #15)

Last commit: `1e0a686`. Tell the next session to read this file first.

## Done (desktop ≥1280px, Tailwind breakpoint `desk:`; 900–1279 and phones unchanged)
- `src/components/shell/sidebar.tsx`: floating glass rail, 64px at rest, 240px on hover or keyboard focus (`has-[:focus-visible]`, so a mouse click does not pin it open). Uses `!fixed` because `.glass` sets `position: relative`. Not shown on /map, /ask, stage-check.
- `app-shell.tsx`: `side` flag; Compass is `desk:hidden` when side; main `desk:pl-[calc(88px+40px)]`; detail "slab" loses its border, background and padding at `desk:`; Dock and VoiceCaption `desk:left-[88px]`.
- `module-tabs.tsx`: pill row `desk:hidden` (the sidebar lists the same pages).
- `home.tsx`: wrapper grid `desk:grid-cols-[1.2fr_1fr]`. Filter row, AlertChip, Briefing, Inbox and Goals span 2 columns. ThreeThings | UpNext sit side by side (`desk:contents`). DOM order unchanged.
- `scene-host.tsx` and `life-map-scene.ts`: Home stage starts at `88px + 32%` of the remaining width. The backdrop gutter map starts at `50% + 564px` and shows from 1700px (`max-[1699px]` / `(max-width: 1699px)` must stay in sync).
- Also in this commit: glass on every `.bg-card.border-line` card (globals.css), orbs fade as Home scrolls, Home cards use `glass`.

## Open items
1. **Grid for other screens.** Only Home has the 2-column grid. The user wants the rest to feel like Apple widgets: free-standing cards, no outer box. Next: Budget and the other card screens (check at 1280, 1440, 1920).
2. **Plan-lock labels** ("Plus" / "Together", `lockedBy` in `lib/plans`) were on the old pills and are missing from the sidebar at desk.
3. **e2e:** `tests/e2e/offline.spec.ts:34` ("offline pages follow the language") fails with `ERR_FAILED` on `/week` while offline. Not confirmed whether it predates this work (layout-only change, 390px viewport). Check by running it on the commit before `1e0a686` (`4b943ec`). The other 28 Playwright tests, tsc, eslint and vitest (213) passed before the last two tweaks (rail and frameless); re-run the verifier.
4. Untested: Safari on a real iPhone (many glass layers); desktop layouts have no Playwright coverage (it runs at 390px).
5. The user has not reviewed 1920px detail screens since the rail change (the gutter map position was recomputed, not re-viewed).

## Preview setup (if re-doing visual checks)
- Servers: `e2e-stub` (port 54399) then `app-stubbed` (port 3101; stop `dev` on 3002 first, or Next refuses to start).
- Login: from the seed tab fetch `http://localhost:54399/__seed` and `/__session`, set localStorage `sb-localhost-auth-token` on the app origin, and cookie `NEXT_LOCALE=id`.
- Set the viewport with `resize_window` (it is cleared at the end of each turn); reset with preset `desktop` afterwards.
- A deep link to a detail screen shows no map by design; navigate from Home to see the gutter map.

## Rules from the user
- Do not commit without a yes. Answer in Indonesian.
- CLAUDE.md: classify the task; for HARD work ask for `/compact` first; use the verifier after changes and the advisor before declaring done.
