# Fable A: Clopar voice failure review + satu-ruang code review (2026-11-17)

Read-only review of `origin/claude/effendy-family-app-setup-fe1wl1...HEAD` (76 files) and all voice paths in `src/`. High confidence on code-path findings; no tests run, no live realtime session (no OpenAI key locally), DB not queried (schema from `supabase/migrations`), OpenAI Realtime event behaviour from API knowledge. Correction: tier 2 is not offline: Chrome speech recognition and `/api/ask` need internet, so a Wi-Fi drop kills tiers 1, 2 and typed input together.

## 1. Top 5 risks before the talk

1. **Realtime voice never ran end to end; failure handling wrong in 3 places.** Any realtime `error` event sets a sticky error card hiding captions/tool cards while Clopar keeps talking (`assistant.tsx:246-249`, `shell/voice-caption.tsx:90-97,115`). A failed response leaves "Thinking…" forever (`assistant.tsx:250-262`, no watchdog). A slow SDP POST is reported as "microphone is off" and skips fallback (`lib/assistant-client.ts:90` + `assistant.tsx:203,318`). Session config (model, event names, transcription) unproven: do the first real test this week.
2. **Double-start = two live Clopars.** `startVoice` has no in-flight guard (`assistant.tsx:312-329`); dock toggles on `voiceOn`, false while connecting (`shell/dock.tsx:37`); nothing shows "connecting". A second click during the 2-10 s connect orphans the first peer connection; both answer aloud.
3. **Mic always open, no mute/push-to-talk; tiers 3 and 4 effectively missing.** `setMuted` mutes output, not mic (`assistant-client.ts:111-113`). Clopar answers narration, audience noise, PA echo. Tier 3 doesn't exist; typed input fails whenever realtime fails (`assistant.tsx:346-353`).
4. **Demo data and quota can sink the demo before it starts.** `scripts/demo-seed.mjs:165` inserts into `subscriptions`, dropped by `supabase/migrations/20261105000000_merge_subscriptions.sql:16`; script aborts after `reset_my_data` (line 158), leaving a half-seeded household. An unclosed voice session is billed up to 3600 s next start (`20261107000000_assistant.sql:30-41,57-59`); two exhaust the 7200 s month. `voice_quota` has no fallback (`assistant.tsx:318`); session ends silently when the minutes timer fires (`assistant.tsx:198`).
5. **Scene stability over 30 min on projector.** Every tab return reloads data (`money-data.tsx:153-154`, `time-data.tsx:159`, `finance-data.tsx:193`) -> new graph -> `setGraph` full dispose/rebuild with fade from zero (`scene/scene-host.tsx:100`, `lib/life-map-scene.ts:731-735`). Pixel ratio never re-applied when moving Retina -> projector (`life-map-scene.ts:465-475,483-485`): 2.25x needed pixels. Stage mode only exists once the scene exists: reload on `/built` or `/budget` leaves keys dead (`scene-host.tsx:58-59,155-156`).

## 2. Voice failure matrix (severity)

| # | Failure | Handled? / what audience sees | Sev |
|---|---|---|---|
| 1 | Wi-Fi drops mid-session | Only noticed via `pc.connectionState` + 3 s wait (`assistant-client.ts:97-107`); no `channel.onclose`, no `offline` listener, no think watchdog. Falls to tier 2 (also needs net) -> "can't answer right now". Audio cuts, caption frozen 8-13 s. | Critical |
| 2 | Mic permission denied | Card shown, but `getUserMedia` outside `try` (`assistant-client.ts:66`) leaks RTCPeerConnection + AudioContext. Prompt waits with no timeout. | Medium |
| 3 | Mic revoked / device vanishes | No `track.onended`/`devicechange`. "Listening…" forever. | High |
| 4 | HDMI moves output to silent projector | No `setSinkId`; stage-check plays no tone (`stage-check.tsx:92-100`). Clopar speaks silently; only first sentence captioned (`assistant-events.ts:13`). | High |
| 5 | OpenAI slow at connect | SDP POST `AbortSignal.timeout` -> `DOMException` -> mapped to `mic` (`assistant.tsx:203`), no fallback (`:318`). | High |
| 6 | 429/server error mid-session | `error` event sets sticky `failed` (`assistant.tsx:246-249`); failed `response.done` not inspected (`:250-262`). | Critical |
| 7 | Benign `error` events (e.g. `response.create` racing VAD, `:231`) | Same sticky path. | High |
| 8 | Ephemeral token/session expiry | Token minted before mic prompt; server-side end unhandled. | Medium |
| 9 | Voice minutes run out | Start: `voice_quota` card, no fallback; mid-session: silent `stop()` (`:198`). | Critical if unchecked |
| 10 | Tool call hangs | `runAssistantTool` has no timeout (`assistant-client.ts:26-27`). | Medium |
| 11 | Tab backgrounded | Mic stays hot during slides; return triggers reload + rebuild. | High |
| 12 | Autoplay policy | Mostly fine; `ctx.resume()` never called. | Low |
| 13 | Wrong transcription language | Hint fixed per session from `voiceLang` default = UI locale English (`assistant.tsx:100`, `session/route.ts:47,76`); presenter must press `I`/`D` first (`presenter.tsx:63-67`), which stops the session. | High (procedural) |
| 14 | Tool cards/caption desync | (a) barge-in leaves `steps.current` (`assistant.tsx:254-260`); (b) `heard` not cleared at answer end (`assistant-events.ts:31-32`); (c) late transcript puts previous question in trace. | Medium |
| 15 | Double-start / uncancellable connect | `stop()` during connect doesn't cancel it. | Critical |
| 16 | Stuck "listening" | Rows 3, 8, tier-2 recognition ending without error. | High |
| 17 | Stuck "speaking" after `/api/ask` | Mode never returns to calm (`assistant.tsx:379-386`); close needs `voiceOn`/`typing` (`voice-caption.tsx:163`). | Medium |
| 18 | Tier 2 hears itself | Watchdog `max(4 s, 90 ms/char)` doesn't cancel speech (`browser-voice.ts:81`); no explicit `id-ID`/`de-DE` voice. | High (tier 2) |
| 19 | Echo/room noise in tier 1 | No mic mute / PTT. | High |
| 20 | `show` to a screen that hides dock (`map`, `ask`) | `app-shell.tsx:75` unmounts dock+caption; no stop control. | Low-Med |
| 21 | Accidental `I`/`D`/`E` | Each calls `stop()` unconditionally. | Medium |

## 3. Fallback ladder + plan

| Tier | What | Enter | Key | Label |
|---|---|---|---|---|
| 1 | Realtime WebRTC | default | `Space`/orb | none |
| 2 | Browser recognition + `/api/ask` + speechSynthesis | auto | `T` | "Browser voice" |
| 3 | Recorded real answers on Brandt data | never auto; strip shows "VOICE DOWN · R" | `R` next, `Shift+R` repeat | "Recorded earlier" |
| 4 | Typed input | never auto | `K` | "Typed" |

**1->2 automatic when any of:** session POST fails or >6 s; SDP/data channel not open in 5 s; peer `failed` or `disconnected` >3 s; data channel closes; no realtime event for 8 s in `think`; two failed responses in a row; `voice_quota`.
**2->3 never automatic** (recordings only match scripted questions; auto-play would fake a live answer). Show hint when `navigator.onLine === false`, recognition error `network`/`service-not-allowed`, or `/api/ask` errors / >12 s.
**Typed routing:** realtime text session if live, else straight to `/api/ask` on any realtime failure. **No auto-return to tier 1**; manual `Space`.

### Step 0: harden tier 1+2 (~3 h) — `assistant.tsx`, `assistant-client.ts`, `browser-voice.ts`
1. Start guard (`starting` ref) + `gen` counter bumped by `stop()`; after `await open()` close if moved; show "Connecting…" (include `connecting` in caption `active`).
2. Classify errors: `mic` only for NotAllowed/NotFound/NotReadable/Security; else `failed`. Move `getUserMedia` inside `try`.
3. Log `error` events, no card. On failed `response.done` return to `listen` and count; two in a row -> drop handler.
4. Think watchdog (8 s); 6 s timeout on `runAssistantTool`.
5. `onDrop` from `channel.onclose`, mic `onended`, window `offline`.
6. Caption state: clear `steps.current`/`liveSteps` on `speech_started`; clear `heard` on `output_audio_buffer.stopped`; after `/api/ask` with no speech return to calm after `max(3 s, 65 ms/char)`.
7. Typed fallback: when `open(false)` fails for anything but `ai_quota`, fall to `askClopar`.
8. Minutes: show quota error when timer fires; on `voice_quota` start tier 2 if possible.
9. Tier 2 speech: explicit voice by language, watchdog `max(6 s, 140 ms/char)` cancelling speech; in stage mode wait for key before listening again.
10. `/api/assistant/end`: send only last 30 turns (keepalive cap 64 KB).

### Step 1: presenter override (~2 h)
`setMicOn(on)` on `Realtime` (mic tracks `enabled`); context adds `micOn`, `setMicOn`, `forceTier`, `playSample(dir)`, `openTyping()` (lift `typing` out of `VoiceCaption`). Keys: `Space` start/toggle mic; `M` mute ("MIC OFF"); `T` tier 2; `R`/`Shift+R` recordings; `K` typing; `X`/`Esc` stop; `I`/`D`/`E` stop only if language changes. Strip shows tier, mic, minutes left (`quota.voiceLeft`), "VOICE DOWN · R". Mount `Presenter` + stage flag independent of scene.

### Step 2: tier 3 recordings (~4-5 h incl. recording)
1. Recorder in stage mode when `sessionStorage["rideff-rec"]="1"`: MediaRecorder on remote stream in `pc.ontrack`; on final `response.done` download audio + JSON (heard, answer, steps, language). ~1 h.
2. Assets `public/demo/voice/{id-1,id-2,id-3,de-1,de-2}.webm` + `src/content/canned.ts` exporting `CANNED[]` (`id, lang, heard, answer, steps, show?, audio`).
3. Player `src/lib/canned-voice.ts`: `preloadCanned()` fetches to blob URLs at presenter mount (works offline; CSP allows `media-src blob:`); `playCanned` via analyser/`bandsOf`.
4. Sequencing in `assistant.tsx` `playSample`: stop session, tier `canned`; show question in `listen` ~1.2 s; `think` with recorded steps on timers + dispatch `show`; `speak` reveal by playback progress; on end add trace, calm. No `ai_messages` writes. Extend tier types with `"canned"`.
5. Label `trace_canned` in `scripts/messages-assistant.json` (en/de/id), run `node scripts/build-messages.mjs`.
6. e2e in `tests/e2e/voice.spec.ts`: offline context, `R`, expect chip, cards, answer.

## 4. Code review findings

**Critical**
1. **Seed aborts halfway after reset.** `demo-seed.mjs:75-78,165` vs `subscriptions` drop migration. `--dry-run` can't catch. Fix: move 5 subscriptions into `recurring` (negative `amount`, `is_subscription: true`, `last_used_at` >90 days for unused), remove `subscriptions` from loop, probe every target table with zero-row select before `reset_my_data`. Related: comment says three unused subs ~38 but only two marked (27.98); VAT event at Monday+5 (`:94`) vs deadline today+5 (`:83`) -> two dates; UTC dates off by a day 00:00-01:00 Berlin.
2. Double-start/uncancellable connect (`assistant.tsx:181-207,312-329`, `dock.tsx:37`, `voice-caption.tsx:87-88`).
3. `error` events/failed responses mishandled (`assistant.tsx:246-262`).
4. Voice minutes burn: add "Voice minutes left" row to `/stage-check` (red <20 min; `voice_left` already returned, `stage-check.tsx:103`); close session on `visibilitychange` hidden when not in voice; reset demo member's `usage` row before talk (needs user permission).
5. No mic mute/PTT (`assistant-client.ts:111-113`).

**High**
6. Full scene rebuild on every data reload (`scene-host.tsx:100`, `life-map-scene.ts:227-399,731-735`, 3 `visibilitychange` reloads, `assistant.tsx:430`, `household-live.tsx:43-46`). Fix: signature of nodes/edges, only `setGraph` on change; start node opacity from previous.
7. Stale pixel ratio after moving displays (`life-map-scene.ts:151,465-475,483-485`): call `applyDpr()`/`rescale()` in ResizeObserver. Checklist: reload after moving window, HUD reads `dpr 1`.
8. Stage mode depends on scene (`scene-host.tsx:58-59,62-71,78-80,94,155-156`): reload on `/built` kills keys; WebGL failure removes keys; GPU context loss remounts Presenter (beat resets to 1). Fix: own mount effect for stage flag; Presenter with `scene | null`.
9. SDP timeout reported as mic error; leak on mic denial (matrix 2, 5).
10. Typed input fails whenever realtime fails.
11. Tier 2 self-listening/voice choice; no client timeout on `/api/ask` (Opus-class, `ask-server.ts:13`, 5-15 s).
12. `/stage-check` can't prove the demo (`stage-check.tsx:92-117`): add 440 Hz tone 0.4 s; rows for voice session asserting first audio-transcript delta, `/api/ask`, minutes, pixel ratio/resolution.

**Medium**
13. Caption/trace desync; show last two sentences in stage mode (`voice-caption.tsx:97`).
14. `/api/ask` answers leave mode at `speak`.
15. Freeze state out of sync (`life-map-scene.ts:724-727,753-762`, `presenter.tsx:57-61`, `scene-host.tsx:113-117`): `B`-freeze gets resumed by visibility/mode change; fix with internal `frozen` flag respected by `resume()`.
16. Per-frame layout reads in label pass (`life-map-scene.ts:684-701`, sorted copy `:687`, filter `:557`); now runs on Home all talk. Cache label sizes after `build()`, precompute sort.
17. Paused flight never resolves (`life-map-scene.ts:707-713,766-791`): snap to end and resolve in `pause()`.
18. Context churn: every transcript delta re-renders all `useAssistant` consumers incl. hidden `<Activity>` screens (`assistant.tsx:117-120,481-484`): split fast talk state into own context.

**Low**
19. `window.__rideffScene` exposed in production (`scene-host.tsx:82`): gate on stage/tests.
20. A PIN on the demo account breaks the talk (digit keys = tour keys, `lock.tsx:234-242`, lock on tab return `:67-81`): checklist: no PIN.
21. Seed guard accepts any household <=2 members still named "Household" (`demo-seed.mjs:146-150`): require `--first-run`.
22. Seed inserts shared `ai_memories` from client (`:104-107`); unchecked whether RLS allows `scope: "shared"`.
23. `home.tsx:62-65` celebrate timeout not cleared when hidden. Cosmetic.

**Checked and sound:** no hydration mismatch in diff; `SceneHost` outside keyed `<ViewTransition>` (one WebGL context), `dispose()` complete; particle `destroy()` complete; `traces` capped at 10, `uVoice` capped; `rideff:show` targets re-validated; RLS: seed and tool calls run as signed-in user, no service role.

## Verify after fixes
1. `npx tsc --noEmit && npx eslint src tests && npx vitest run`, then `npm run test:e2e:build && npx playwright test`.
2. Seed: `node scripts/demo-seed.mjs --check`, then real run; `/map` >=6 items per area; Clopar names unused subs and "72 euros short" for VAT.
3. Realtime with key on Brandt data: 3 Indonesian + 2 German questions; double-click orb while connecting (one session); interrupt mid-answer (no stale cards); talk to audience with `M` on (no response).
4. Network: Wi-Fi off mid-sentence -> tier-2 chip or "VOICE DOWN · R" within 5 s, `R` plays labelled recording offline; throttle 2G during connect -> tier 2, not mic error.
5. Scene: Cmd-Tab away/back x10 no blink; laptop->projector drag HUD `dpr 1`; reload on `/built` keeps HUD/keys; 30-min soak with voice >=55 fps.
6. Stage check: audible tone on intended output, minutes row green, household row green.

## Decisions and risks for the user
- Hard to reverse: `reset_my_data` in seed wipes demo person's rows; run only on Brandt account and only after table probe exists.
- Needs permission: resetting demo member's `usage` row before the talk.
- Recordings must come from a real session, so tier 1 must work once before tier 3 exists. If realtime unproven by ~day 5, decide whether tier 2 + recordings becomes the primary plan.
- Audio: decide output device (laptop speakers vs venue PA) and mic (built-in vs headset). PA + built-in mic makes push-to-talk mandatory.
- Language: keep explicit switch (`I`/`D`, restarts session, loses context) or drop transcription hint and auto-detect. Recommendation: keep hint and rehearse the key.
