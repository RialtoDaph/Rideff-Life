# Fable B: talk script, runbook, Plan B, product gaps (2026-11-17)

High confidence on everything read from code/migrations. Not checked: live DB, deployment, working keys. Only ran seed `--dry-run` and two unit test files.

## Corrections to earlier assumptions
- Tour has **6 beats**; jump keys `1`-`6` (not 1-4); `I`/`D`/`E` set voice language. `R` and hold-Space do not exist.
- `scripts/demo-seed.mjs:75-78,165` inserts into `subscriptions`, dropped by `supabase/migrations/20261105000000_merge_subscriptions.sql:16`; reset at `:158` runs first, so a real run leaves a half-seeded household.
- This checkout has no `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` commented out, `.env.demo.local` missing. Voice unproven end to end; seed not run from here.
- Realtime tools (`src/lib/assistant-tools.ts:22-64`): budget, goals, week, net worth, simulate, 3 `propose_*`, remember, forget. No subscriptions or tax-deadline read -> two of the earlier five scripted questions can't be answered.
- Save card (`ConfirmCard`) not rendered on Home (only `screens/ask.tsx:114`, `screens/life-map.tsx:361`); `shell/voice-caption.tsx` never reads `pendingCard`.
- Mic open with `semantic_vad` (`api/assistant/session/route.ts:76`); `setMuted` mutes output only (`assistant-client.ts:111-113`).
- Voice language defaults to UI locale (English), resets on reload (`assistant.tsx:99-100`).
- Plan gate: `map` needs Life Plus (`src/lib/plans.ts:16`), Life has 0 voice minutes, trial 14 days, voice cap 7200 s/member/month.

## Verified controls
| Key | Does |
|---|---|
| `.` / `→` | next beat (stops at 6) |
| `,` / `←` | previous beat |
| `1`-`6` | jump: home, map, areas, clopar, built, wrapped |
| `B` | freeze/thaw scene |
| `I` / `D` / `E` | voice language ID/DE/EN; also ends conversation (= mic off) |
| `Esc` | close sheet; on Map goes Home |
| `⌘K` | command palette |

Keys ignored while a text field has focus or a modifier is held. No key for "See trace" or Save (trackpad). Stage mode `?stage=1` once, remembered per tab. HUD bottom-left: `60 fps · high · dpr 1` and `4/6 · clopar · ID · . , I D E`; `NOT DEMO` means tour keys are dead by design.

Rules from code: (1) language resets to EN on every reload, press `I` after every `⌘R`; (2) mic is open while Clopar listens, so speak to the audience before opening it or after closing; mic off = `I`/`D`, on = `4` (~2 s + connect); (3) closing the mic removes caption and trace: open "See trace" while the session is live, stay silent, then close.

## Part 1: talk script (25 min)
| # | Segment | Key | Starts | Len |
|---|---|---|---|---|
| 0 | Intro | `B` | 0:00 | 2:00 |
| 1 | Home | - | 2:00 | 2:30 |
| 2 | Map | `.` | 4:30 | 2:30 |
| 3 | Areas | `.` | 7:00 | 3:00 |
| 4 | Clopar | `I`, then `.` | 10:00 | 7:00 |
| 5 | Built | `.` | 17:00 | 5:00 |
| 6 | Wrapped | `.` | 22:00 | 1:30 |
| 7 | Close | `1` | 23:30 | 1:30 |

Checkpoints: Clopar by 10:00, Built by 17:00, Wrapped by 22:30. Cut order if late: German question 3, pill clicks in beat 3, Built rounds B/C/F. Numbers below are from the seed as written (after the seed fix, run that morning); replace with rehearsal 1 results.

**0 Intro** — Home in stage mode, scene pre-frozen. Says (ID): "Halo semuanya, saya Rialto. Saya tidak bawa slide. Yang di layar ini aplikasinya sendiri, berjalan live, dan dialah slide saya." / "Namanya rideff Life: satu tempat untuk uang, waktu, kesehatan dan tujuan satu rumah tangga. Datanya dummy: keluarga Lena dan Tom Brandt di Leipzig." / "Ini dibangun satu orang bersama Claude Code, dalam delapan putaran kerja. Saya tunjukkan dulu hasilnya, lalu cara membangunnya, termasuk yang salah." / "Dan ini bukan screenshot." Key `B`. Transition: "Mulai dari satu angka."

**1 Home** — hero number (~€1,060), Per day / Days left / Spent, live scene right. Says: "Satu layar, satu angka: uang fleksibel yang masih boleh dipakai bulan ini. Semua yang lain ada untuk menjelaskan angka itu." / "Yang bergerak di kanan bukan video. Itu peta hidup keluarga ini, digambar langsung dari data mereka." / "Versi pertama Home adalah grid kartu yang sama besar. Rapi, tapi tidak ada yang bilang mana yang penting. Pelajaran pertama: minta AI memilih satu hal, bukan menata sepuluh hal." Transition: "Angka ini datang dari mana? Kita masuk ke dalamnya." `.`

**2 Map** — same canvas goes full screen, camera flies to Money (~4.5 s). Says: "Ini adegan yang sama dengan tadi, bukan halaman baru. Kanvasnya satu untuk seluruh aplikasi; kita hanya memindahkan kamera." / "Di tengah ada Life Score. Di sekelilingnya empat area... Setiap titik kecil adalah satu hal nyata." / "Cahaya lembut ini dibuat di dalam shader, bukan efek di atasnya." Transition: "Uang cuma satu dari empat. Kita keliling." `.`

**3 Areas** — camera flies Time, Health, Goals, core (~0.7 s each, can't be held). Click Health and Goals pills. Says: "Health dihitung dari yang benar-benar dicatat... Area tanpa data tidak diberi skor; tidak ada angka yang dikarang." / "Rumus skor ini kami tulis sendiri. Versi pertama memberi nol untuk keluarga yang sudah 80 persen di jalur. Jadi diganti: dinilai menurut laju, bukan lulus atau gagal." Before leaving: press `I`, check HUD says `ID`, and while mic closed say: "Sekarang bagian paling berisiko di demo live: saya bicara dengan aplikasinya. Namanya Clopar. Dia tidak diberi data mentah; dia harus memanggil tool, dan tool itu hanya membaca apa yang boleh dibaca orang yang login. Perhatikan kartu kecil di bawah: nama tool dan waktunya dalam milidetik. Mulai sekarang saya bicara ke dia, bukan ke kalian." `.`

**4 Clopar (7 min)** — back on Home; mic connects ~3 s after key, wait for LISTENING… before speaking.
Indonesian round (one open session, no narration):
| Ask | Tool card | Expected |
|---|---|---|
| "Clopar, berapa sisa uang fleksibel kami bulan ini?" | `get_budget` | ~1.060 euro + per-day + days left; scene flies to Money |
| "Dana darurat kami sudah berapa, dan kapan tercapai?" | `get_goals` (maybe `simulate`) | 9.800 of 15.000; at 450/mo ~12 months; scene to Goals |
| "Kalau kami tambah 38 euro per bulan ke dana darurat, jadi lebih cepat berapa bulan?" | `simulate` | 11 months instead of 12 |
Then click "See trace" (Heard / Called / Said), silent 4 s, `Esc`, `I` (mic off). Says: "Yang barusan itu catatan asli, bukan animasi... Angka 38 saya yang sebut; angka 11 bulan dihitung server, bukan ditebak model." / "Bulatan itu dan seluruh peta bergerak mengikuti kerasnya suara... Ini pernah rusak dengan cara lucu: setelah diklik bulatannya kosong, karena partikelnya lari dari kursor yang masih diam di atasnya." / "Keluarga Brandt tinggal di Leipzig. Jadi sekarang bahasa Jerman. ..."
German round: `D` (HUD `DE`), `4`, wait for LISTENING…
| Ask (DE) | Tool | Expected |
|---|---|---|
| "Clopar, was steht diese Woche bei uns an?" | `get_week` | next 7 days (Tom's early shift, date night Friday, VAT pre-return Saturday on a Thursday seed); scene to Time |
| "Wie hoch ist unser Vermögen im Moment?" | `get_net_worth` | ~24.500 € (28.290 − 3.794); scene to Money |
| optional "Zeig mir bitte unsere Schulden." | `show` | opens Debts |
Then `D` (mic off). Do NOT ask about unused subscriptions or VAT amount, or ask Clopar to book anything (see P0-4/5). Transition: "Jadi bagaimana semua ini dibangun? Aplikasinya bisa menceritakannya sendiri." `.`

**5 Built (5 min)** — "8 rounds of work · 196 automated tests · 32 screens", cards A-H, decisions. Scroll with `↓`/trackpad; never `←`/`→`. Says: cara kerja (rencana tertulis, satu fase, semua tes, berhenti, lapor; AI tidak boleh commit/deploy/sentuh DB tanpa diminta); round A audit (trial tidak ditegakkan, biaya AI tanpa batas, kini dibatasi di database); round G (panel kaca terbaca buruk di proyektor, dibuang); gerbang 60 fps dulu; model lebih kuat meninjau model lebih murah (temuan: bahasa suara salah, koneksi putus = diam, tidak ada penjaga data keluarga asli di panggung; tur menolak jalan kalau bukan keluarga demo); "Privasi diputuskan database, bukan layar. Asisten tidak pernah menyimpan sendiri: dia mengusulkan, orangnya yang menekan Save."; tiga takeaway: rencana tertulis + berhenti per fase; biarkan AI lain mengaudit; catat yang salah. `.`

**6 Wrapped (1:30)** — 9:16 card. `.`, click "Save image", do not click Share. Says: "Life Wrapped: satu bulan keluarga Brandt dalam satu kartu. Hanya angka, tanpa nama..." `1`.

**7 Close (1:30)** — Home. "Ini bukan soal AI menulis kode dengan cepat. Ini soal kita tetap memegang tempo: rencana, gerbang, tes, dan berani menulis apa yang salah." Q&A with Clopar: `I`/`D`/`E` then `4`.

## Part 2: runbook
**Pre-flight (day of)**
- Data/account: after P0-1 run `node scripts/demo-seed.mjs --check` then real run that morning (anchors dates to run day, clears rehearsal chat/memories). `/plan`: Together, trial ends after talk, voice minutes well under 120. `/map`: no "Life Plus" unlock card. Top left "Lena & Tom Brandt"; HUD never `NOT DEMO`.
- Chrome: dedicated Demo profile signed in only as Lena, no extensions; bookmarks `/?stage=1`, `/stage-check`, backup video; graphics acceleration on, Energy Saver and Memory Saver off; site permissions for demo origin: Microphone Allow, Sound Allow.
- macOS: mic allowed for Chrome; Focus/DND on; quit Mail, Messages, Telegram, Slack; no sleep/screensaver, Low Power Mode off, hot corners off.
- Display: extended not mirrored, projector 1920x1080 60 Hz, Chrome full screen on projector. Clicking the laptop screen steals keyboard focus -> keys die.
- Sound: pick output by hand (macOS may move audio to silent HDMI); stage-check "Sound output" plays no tone, so play a real Clopar answer and listen from the back. Check mic level.
- Network: own phone hotspot primary, second ready; don't use venue Wi-Fi for voice unless `/stage-check` "Realtime link (WebRTC)" Ready on it.
- Power: charger in, battery >50% (Chrome caps to 30 fps on low battery); check refresh rate (30 Hz link looks the same).
- Backup video open, paused at 0:00.

**10 min before:** charger, hotspot, HDMI, display+sound checked -> open `/?stage=1` -> `/stage-check` "Wake Clopar", all 10 rows green (Internet, Demo household, 3D map, Power, Frame rate, Microphone, Sound output, Realtime voice session, Realtime link, Browser voice) -> press `1 2 3 5 6 1` slowly -> `I`, `4`, wait LISTENING…, "Clopar, tes satu dua", hear it in the room, `I` -> `1`, HUD `60 fps`, `1/6 · home · ID` -> `B` freeze, click empty background once, pointer near bottom centre -> don't touch the laptop screen again.

**Rehearsals**
| | When | Setup | Goal |
|---|---|---|---|
| R1 | when P0 fixed (~T-6) | desk, external 1080p monitor extended, charger | every key/question works; record real numbers/answers into this script; time each beat |
| R2 | T-3 | real projector/TV over HDMI, hotspot, standing, aloud | full run on timer; break on purpose (Wi-Fi off mid-answer, HDMI pulled, reload per beat, skip `I` after reload); record 90 s backup video of beat 4; check voice minutes; freeze code |
| R3 | T-1 or in the room | frozen build, exact origin and network | full run at tempo, listener 6 m away; settle cut list; change nothing |

## Part 3: Plan B
**Recovery ladder:** scene frozen/blank -> `B`,`B`, then beat number, then `⌘R`, `I`, beat number. Keys dead -> click empty background; no HUD -> click `/?stage=1` bookmark, `I`, beat number. HUD `NOT DEMO` -> STOP, don't navigate by mouse (another household's data), go to the video. HUD jumped to `1/6` -> press beat number, not `.`. Clopar won't stop or answers narration -> language key. Clopar opened another screen -> `4`. Don't debug >15 s: next beat or video.

**Per beat** (freeze / voice dies / network drops / projector flickers / blank-line): Intro: `B` again else `1` / n.a. / carry on / hands off 5 s / "Yang di layar ini aplikasinya sendiri, dan dialah slide saya." Home: `B`,`B` else `⌘R`,`I`,`1` / - / number stays, carry on / wait then `1` / "Satu angka. Semua yang lain ada untuk menjelaskan angka itu." Map: `2` replays flight / - / carry on / wait then `2` / "Satu kanvas untuk seluruh aplikasi; kita hanya memindahkan kamera." Areas: `3` replays or click pills / - / carry on / wait then `3` / "Empat area, satu skor, dan tidak ada angka yang dikarang." Clopar: `⌘R`,`I`,`4` / voice ladder / voice ladder / wait, `I`, `4` / "Dia memanggil tool, dan tool itu hanya membaca apa yang boleh saya baca." Built: `⌘R`, click logo, `I`, `5` / - / no effect / wait, scroll / read the "What went wrong" column aloud. Wrapped: `6` / - / no effect / wait, `6` / "Satu bulan dalam satu kartu, hanya angka." Close: `1` / skip Clopar Q&A / skip Q&A / finish without screen / "Rencana, gerbang, tes, dan berani menulis yang salah."

Map special cases: "Life Plus" card over the map -> `1` and tell beats 2-3 from Home's scene. Plain list instead of 3D -> "Ini peta yang sama tanpa 3D, untuk perangkat yang tidak sanggup", `⌘R`.

**Voice ladder (beat 4):** (1) no LISTENING… after 10 s: click orb once. (2) error card: "Try again" once. (3) still failing: "Type instead", same question, Enter; say "Suaranya menyerah, otaknya tidak." (4) "Browser voice" badge: carry on (robotic voice, no tool cards); "Ini cadangan: suara browser, data yang sama." (5) wrong language/garbled (HUD `EN`): `I`, `4`. (6) network gone: `5` Built beat, return with `4`; if still down, play the video: "Ini direkam kemarin, di laptop yang sama."

## Part 4: product gaps
**P0 (talk fails without):** 1 seed aborts after wiping household (`demo-seed.mjs:165`): write the five subscriptions as `recurring` rows (`is_subscription: true`, negative `amount`, `last_used_at` >90 days on unused); until then Money has only 3 debt items. 2 voice unproven/unconfigured: decide demo origin, set both keys there, pass 3 ID + 3 DE questions with tool cards. 3 plan/quota for demo household: set Together/active and reset voice usage (needs Rialto's OK). 4 no tools for subscriptions/taxes (`assistant-tools.ts:22-64`): add `get_subscriptions`/`get_taxes` and map in `src/lib/show.ts:23`, or keep out of script. 5 render `ConfirmCard` in `voice-caption.tsx` so a write can be approved on Home. 6 mic mute key (e.g. `M`) disabling the track without ending the session (`assistant-client.ts:111`, `presenter.tsx:55`). 7 voice language default `id` in stage mode, kept in sessionStorage (`assistant.tsx:99-100`).

**P1:** 8 no "connecting" state (`voice-caption.tsx:87-88`). 9 trace and last answer vanish on mic close. 10 beat 3 can't be held (`presenter.tsx:44-48`): `.` should step one area at a time. 11 thin/week-anchored demo data (`demo-seed.mjs:35,91-95`): events from Monday of seed week (Thursday shows 3, Sunday none); no learning items; Health 4 items, Goals 5 (plan wanted >=6 per area); VAT deadline (seed+5) vs VAT event (Saturday) disagree; English event titles in German household; UTC not Berlin. 12 presenter depends on scene (`scene-host.tsx:155-156`): reload on `/built` kills keys/HUD/zoom; beat resets to 1 on reload/GPU context loss; no presenter if WebGL fails: mount independently, derive beat from route. 13 slow SDP reported as mic error and blocks backup (`assistant-client.ts:90`, `assistant.tsx:203,318`). 14 stage zoom misses trace sheet/Compass/Dock (`globals.css:367-370`). 15 no recorded fallback (`R` key/tier 3 unbuilt; no backup video in repo). 16 stage-check gaps (`stage-check.tsx`): no voice-minutes row, no audible tone, no `/api/ask` check, no map-unlocked check. 17 `show` can open `/map` or `/ask` where caption and dock are hidden (`app-shell.tsx:75`). 18 `/built` text-only, hand-counted numbers (`src/content/built-stats.ts`, dated 2026-11-14); add real artifacts.

**P2:** 19 `B` out of step after route change (`presenter.tsx:32,57-61`). 20 `PageDown`/`PageUp` unbound (`src/lib/tour.ts:27-28`). 21 holding `.` skips beats (no `e.repeat` guard, `presenter.tsx:55`). 22 every mic close runs memory extraction (`api/assistant/end/route.ts`), rehearsals leave memories (seed clears them). 23 Share button on Wrapped (`wrapped.tsx:104`): hide in stage mode.

## Decisions for Rialto
DB writes need explicit OK (running seed, setting plan Together/active, resetting voice usage; seed is destructive for that household only). Which origin runs the demo (Vercel vs local prod build; keys, login, mic permission are per origin). Feature freeze after R2. Backup video must be recorded in R2. Subscription/tax storylines: add two read tools or drop.
