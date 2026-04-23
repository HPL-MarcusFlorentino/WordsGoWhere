# CLAUDE.md — Playable Ads

## Stack
Phaser 3.90 · TypeScript · Vite + vite-plugin-singlefile · WebP · MP3 96kbps
Networks: AppLovin (al) · GoogleAds (gg) · IronSource (is) · Mintegral (mtg) · Facebook (fb) · Unity (un) · Vungle (vu) · Moloco (mo) · TikTok (tt)

## Project setup (fresh scaffold)
Read this whole section **before writing any file.** Each rule exists because skipping it causes a specific failure — the rule and the failure are paired so you can judge edge cases. Verify every item as you go; don't batch.

### Build config
1. **Vite `build.rollupOptions.output.format: 'iife'` + `modulePreload: false`.** Ad networks reject ES modules — `type="module"` scripts fail to load in most sandboxes. Also strip `type="module"` and `crossorigin` from the emitted `<script>` tag in the build script.
2. **`build.assetsInlineLimit: 100_000_000`** so every asset inlines. `vite-plugin-singlefile` only inlines assets imported from JS — any raw `<img src="…">` in `index.html` ships as a broken relative path in the ad sandbox.
3. **`cssCodeSplit: false`** so CSS inlines into the single HTML.
4. **Phaser config: `type: Phaser.AUTO, transparent: true, scale.mode: Phaser.Scale.NONE, render.antialias: true`.** `Scale.NONE` = manual sizing; `antialias: true` is required — scaled WebP without it looks jagged on end-card logos and CTA buttons. Never set `antialias: false`.

### Boot sequence (the DPR + timing contract)
5. **Gate boot on `DOMContentLoaded`.** `vite-plugin-singlefile` hoists the bundled script into `<head>` and the build strips `type="module"` — so the script runs **synchronously before `<body>` is parsed**. Without the gate, `document.body` is null and Phaser throws `Cannot read properties of null (reading 'appendChild')`.
6. **Create the parent `<div>` at runtime inside `boot()`, pass the element reference (not a string selector) to `new Phaser.Game({ parent })`.** Previewer sandboxes sometimes strip custom DOM; a string selector finds nothing and the canvas is never attached.
7. **DPR coordinate contract (read carefully — this is the #1 scaffolding bug):**
   - Canvas internal size is `w * dpr × h * dpr`. That's the space Phaser draws in.
   - `game.scale.resize(w*dpr, h*dpr)` sets that internal size.
   - `recomputeResponsive()` **must receive the same DPR-scaled values** (`w*dpr, h*dpr`) so `sx/sy/sd` produce coordinates in canvas-internal space.
   - CSS-px canvas size (`w × h`) is set via `canvas.style.width/height` only — that's display, not coord space.
   - Passing CSS px to `recomputeResponsive` silently puts every element in the top-left quadrant at half-size. No error — just a broken-looking layout that scales wrong.
   - DPR must be clamped: `Math.min(devicePixelRatio || 1, 2)` — uncapped DPR tanks FPS on high-density screens.
8. **`initMraid()` must self-resolve after ~2 s.** `mraid.addEventListener('ready', …)` can miss the event if the container fires it before the listener attaches. Check `mraid.getState() !== 'loading'` first; `setTimeout(resolve, 2000)` as a fallback. Without this, iOS hangs on boot with no error.
9. **Race font loading against a 1.5 s timeout.** `document.fonts.ready` stalls forever in WKWebView with base64 `data:` fonts. `Promise.race([fonts, setTimeout(1500)])`.
10. **Install global `error` + `unhandledrejection` handlers that write to `document.body.innerHTML`** (at least during development). iOS WKWebView failures produce black screens with no visible console — on-screen error text is the only diagnostic without a Mac + Safari remote debug.

### Responsive resize
11. **rAF-debounce resize events + 100/300/600ms retries.** `visualViewport.resize` fires before the viewport fully settles on rotation; single-shot handlers miss the final dimensions. Bind to `resize`, `orientationchange`, and `visualViewport.resize`.
12. **Every scene that positions elements must expose a `relayout()` method** that re-reads `viewW/viewH` and re-applies positions. The main resize handler iterates active scenes and calls it. Creating elements only in `create()` with positions baked in means they never reflow.
13. **`setDisplaySize(sd(w), sd(h))` — never `setScale`.** `setScale` compounds across relayouts; `setDisplaySize` is absolute and idempotent.

### Assets
14. **WebP only, q75.** PNG/JPG are 10–30× larger and blow the 5 MB cap fast. Convert on intake, not at build time. Audio: MP3 96 kbps, trim aggressively.
15. **Import assets from TS, never reference them in HTML.** A `<img src="src/assets/…">` in `index.html` ships as a literal relative path that fails in ad sandboxes. Leave DOM `<img>` with no `src` and assign from `assets.ts` at boot.
16. **Critical preload < 200 KB** (first-frame assets in BootScene). Everything else deferred, with gameplay gated on a deferred-ready flag.

### Lifecycle + SDK
17. **Expose `gameReady` / `gameStart` / `gameEnd` / `gameClose` as stubs on `window`** with `typeof` guards (`?? () => {}`) — every network's preview tool scans for these. The SDK overrides the stub if it has its own; the stub keeps the detector happy otherwise.
18. **Every SDK call guarded with `typeof x !== 'undefined'` AND `typeof x.method === 'function'`.** AppLovin's preview injects `playableSDK` without `reportEvent` — checking just the object passes, calling the method throws.
19. **`notifyGameClose()` fires inside `triggerCTA()` before any redirect**, all networks, always.
20. **`visibilitychange` listener mutes Phaser sound + suspends `AudioContext`** when `document.hidden`. Spec requires audio stop on hide/close; some networks reject ads that keep playing audio after dismissal.

### Project-specific (update per project)
21. Project slug in [scripts/build-all.mjs](scripts/build-all.mjs) — drives output filename.
22. Store URLs in [constants.ts](src/constants.ts) (iOS + Android).
23. Depth Map constants in [constants.ts](src/constants.ts) — never magic numbers in scene code.
24. [iteration.ts](src/iteration.ts) A/B config shape for this project's variants.
25. Asset manifest in [BootScene.ts](src/scenes/BootScene.ts).
26. Rewrite `game/` modules for the new mechanic(s) — single-responsibility split; modules never call ad-SDK functions.

## Structure
```
src/
  main.ts              # Bootstrap, resize, MRAID gating, lifecycle stubs on window
  constants.ts         # Design coords (1080×1920), store URLs
  networks.ts          # triggerCTA(), initMraid(), bindLifecycle(), notifyGameX()
  analytics.ts         # trackEvent() → SDK
  iteration.ts         # A/B iteration config
  utils/
    responsive.ts      # sx(), sy(), sd() — coordinate helpers
  scenes/
    BootScene.ts       # Critical preload + deferred asset manifest
    GameScene.ts       # Orchestrator only — wires game/ modules, handles lifecycle
    cta.ts             # End-card layout + redirectToStore() → notifyGameClose() + triggerCTA()
  game/                # Single-responsibility modules (no direct ad-SDK calls)
    # …one file per distinct mechanic or UI widget
Assets/
scripts/build-all.mjs  # Single build → per-network HTML variants
```

### Responsibility split
- **`game/`** modules each own a single concern (one mechanic, one widget, one system).
  They receive the Phaser scene as a constructor arg and own their own game objects.
  They never call ad-SDK functions (`triggerCTA`, `notifyGameX`, `trackEvent`).
- **`GameScene.ts`** is the wiring layer: creates modules, passes data between them,
  and calls SDK helpers at the correct lifecycle moments.
- **`scenes/cta.ts`** owns end-card presentation and the store-redirect sequence.

## Rules
- 60 FPS target; never below 30 on mid-range Android
- `dist/index.html` < 5 MB; WebP images, short audio
- No hardcoded px — `sx()`, `sy()`, `sd()` only
- No audio autoplay — unmute on first `pointerdown`
- `for` loops in game logic; pool objects; no GC
- `setDisplaySize(sd())` on images — never `setScale`
- Never dim via `body`/page background

## Phaser Config
```ts
{ type: Phaser.AUTO, transparent: true,
  scale:  { mode: Phaser.Scale.NONE, width: 1080, height: 1920 },
  render: { antialias: true, pixelArt: false } }
```
`Scale.NONE` — manual sizing; CSS = viewport px; internal = viewport × DPR.
`antialias: true` — required to avoid jagged edges on scaled WebP assets (end-card logo, CTA, score pill). Never set to `false`.

## Responsive (1080×1920 ref)
```ts
const s    = Math.min(viewW / 1080, viewH / 1920)
const offX = (viewW - 1080 * s) / 2
const offY = (viewH - 1920 * s) / 2
// sx/sy/sd apply offX, offY, s
```
- `update()` polls `visualViewport` per-frame for rotation
- On change: `game.scale.resize(vw*dpr, vh*dpr)` → `relayout()`
- `bindResponsiveResize()`: rAF debounce + 100/300/600ms retries

## CTA — SDK Priority (triggerCTA fallback chain)
```
1. ExitApi.exit()             → GoogleAds (gg)
2. FbPlayableAd.onCTAClick()  → Facebook (fb)
3. Luna.Unity.Playable        → Unity (un)
4. playableSDK.openAppStore() → (runtime fallback if SDK present)
5. window.install()           → Mintegral (mtg)
6. window.openAppStore()      → (runtime fallback)
7. window.clickTag            → Moloco (mo)
8. window.__VUNGLE__          → Vungle (vu) via parent.postMessage
9. window.__TIKTOK__          → TikTok (tt) → openAppStore() or window.open fallback
10. mraid.open(url)           → AppLovin (al) / IronSource (is)
11. window.open(storeUrl)     → Fallback (all others)
```
`notifyGameClose()` fires before every CTA redirect (all networks, no-op when SDK absent).

## Analytics — SDK Priority
```
ALPlayableAnalytics.trackEvent(e)  → AppLovin (al)
playableSDK.reportEvent(e)        → (runtime fallback if SDK present)
console.log('[Analytics]', e)      → All other networks
```
Events: `DISPLAYED` · `CTA_CLICKED` · `ENDCARD_SHOWN` · `CHALLENGE_STARTED` · `CHALLENGE_SOLVED`

## Game Lifecycle (all networks)
`main.ts` exposes stubs on `window` so every network's preview tool detects them.
Stubs only set if the SDK hasn't already provided its own (`typeof` guard).
```
gameReady()  → stub in main.ts; Mintegral also gets onload body attr from build
gameStart()  → notifyGameStart() in GameScene.startPlaying()
gameEnd()    → notifyGameEnd()  in GameScene.triggerFail() / triggerWin()
gameClose()  → notifyGameClose() in cta.ts redirectToStore(), before triggerCTA()
```

### Pause / Resume / Mute (bindLifecycle in networks.ts)
| Network | Mechanism |
|---|---|
| Unity | `luna:mute` / `luna:unmute` / `luna:pause` / `luna:resume` events |
| Mintegral | `window.message` → `onPause` / `onResume` |
| Vungle | `ad-event-pause` / `ad-event-resume` events |
| AppLovin / IronSource | MRAID viewable state (gated in initMraid) |
| GoogleAds / Facebook / Moloco | No SDK pause — browser handles visibility |

## Build
Vite outputs IIFE format (`format: 'iife'`, `modulePreload: false`).
Build script strips `type="module"` and `crossorigin` — ad networks reject ES modules.

| Network | Tag | Folder | Injected | Zipped |
|---|---|---|---|---|
| AppLovin | al | AppLovin | `mraid.js` | — |
| GoogleAds | gg | GoogleAds | `exitapi.js` | ✓ |
| IronSource | is | IronSource | `mraid.js` | — |
| Mintegral | mtg | Mintegral | `onload="gameReady()"` | ✓ |
| Facebook | fb | Facebook | — | — |
| Unity | un | Unity | — | — |
| Vungle | vu | Vungle | `window.__VUNGLE__=true` | ✓ |
| Moloco | mo | Moloco | — | — |
| TikTok | tt | TikTok | `window.__TIKTOK__=true` | — |

Networks marked **Zipped** ingest zipped creatives — [scripts/build-all.mjs](scripts/build-all.mjs) writes a sibling `.zip` next to each HTML (one zip per variant, containing just that HTML at the root). Toggled per-network via `zip: true` in the `NETWORKS` array.

Output: `dist/<Folder>/cm_mip_<project-slug>_<iteration>_<type>_<ugc>_<season>_<lang>_<length>_<region>_<tag>.html`
Example: `cm_mip_pplquiz_01_real_nougc_noseason_en_full_na_al.html`
Project slug is defined in [scripts/build-all.mjs](scripts/build-all.mjs) — update it when porting.

## Asset Loading
- **Critical** (BootScene): first-frame assets, target < 200 KB
- **Deferred**: audio, overlays, secondary UI — loads during intro
- Gameplay start waits on a deferred-ready flag set when the secondary manifest finishes loading

## Depth Map (adjust per project)
Define depths as named constants in [constants.ts](src/constants.ts) — never use magic numbers in scene code.

| Layer | Depth |
|---|---|
| Background | 0 |
| Game objects | 1–10 |
| Logo | 17 |
| Dim overlay | 20 |
| Fail/win UI | 21 |
| EndCard input | 25 |

## Ship Checklist
- [ ] < 5 MB, all WebP
- [ ] FPS ≥ 55 under CPU throttle
- [ ] Portrait + landscape pass
- [ ] MRAID ready before gameplay
- [ ] Audio muted by default
- [ ] CTA fires in fallback
- [ ] No `console.error`
- [ ] No `type="module"` or `crossorigin` on `<script>` in output HTML
- [ ] Lifecycle: gameReady / gameStart / gameEnd / gameClose detected by all network preview tools

## Pitfalls
| Issue | Fix |
|---|---|
| Rotation stuck | `Scale.NONE` + per-frame poll |
| Mobile aliasing | Canvas = viewport × DPR |
| FPS drop on resize | rAF debounce |
| MRAID crash | `typeof mraid !== 'undefined'` guard |
| Assets not inlined | `assetsInlineLimit: 100_000_000` |
| Bundle > 5 MB | WebP q75, shorter audio |
| Audio blocked | Gate on `pointerdown` |
| Letterbox | Avoid `Scale.FIT/EXPAND/CENTER_BOTH` |
| CORS / module error | `format: 'iife'` + strip `type="module"` and `crossorigin` |
| Network preview checklist fail | Expose lifecycle stubs on `window` + call `notifyX()` with `typeof` guards |
| `playableSDK.reportEvent is not a function` | AppLovin preview injects `playableSDK` without `reportEvent` — guard with `typeof playableSDK.reportEvent === 'function'`, not just `typeof playableSDK !== 'undefined'` |
| iPhone black screen (Android works) | **Only one `Phaser.Game` per page, ever.** iOS WKWebView — used by AppLovin/IronSource preview apps and most in-app ad containers — caps or outright rejects the 2nd WebGL context. If a background scene is spun up as a separate `new Phaser.Game()` synchronously at module load, it can throw before `await initMraid()` and before the font promise resolves, so the rest of `main.ts` never runs → black screen with no visible error. Render the background as a CSS `background-image` on `#bg-container` (cover-sized) instead — zero WebGL contexts for the background, and nothing to throw at module-load time. iOS-debug path: enable Safari → Advanced → Web Inspector on the iPhone, connect to a Mac, open Develop → iPhone → preview WebView, read the Console. Without a Mac, temporarily install top-of-`main.ts` `window.addEventListener('error',…)` and `unhandledrejection` handlers that write the error into `document.body.innerHTML` so the failure is visible on-screen. |
| iOS hangs on font load | `document.fonts.load()` silently stalls in WKWebView when `@font-face` uses base64 `data:` URLs. Race against a 1.5 s timeout: `Promise.race([Promise.all([…fonts]), new Promise(r=>setTimeout(r,1500))]).then(startGame)` |
| iOS hangs on MRAID ready | `mraid.addEventListener('ready', …)` can miss the event if the container fires it before the listener attaches. `initMraid()` must self-resolve after ~2 s so `startGame()` always runs; also check `mraid.getState() !== 'loading'` first. |
| External `src=` survives build | `vite-plugin-singlefile` only inlines assets *imported from JS*. A raw `<img src="src/assets/…">` in `index.html` ships as a literal relative path and fails in ad sandboxes, producing inconsistent per-device load failures. Leave DOM `<img>` elements with no `src`; assign via JS from `assets.ts` at boot (`setEndcardHtmlAssets()`). |
| Audio keeps playing when ad hides | Add `visibilitychange` listener in the sound module — mute Phaser's sound system and `suspend()` the `AudioContext` when `document.hidden`, resume on return. Spec requires audio stop on hide/close. |
| `mraid.open()` silently no-ops | Guard with `mraid.getState() !== 'loading'` before calling; fall through to `window.open()` if still loading. |
| Previewer black screen with `Cannot read properties of null (reading 'appendChild')` in Phaser boot | Two compounding causes: (1) `vite-plugin-singlefile` hoists the bundled script into `<head>`, and the build strips `type="module"`, so the script runs **synchronously before `<body>` is parsed** — `document.body` is null. Wrap main.ts in a `DOMContentLoaded` gate (`if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot) else boot()`). (2) `parent: 'game'` (string selector) fails when the previewer sandbox strips custom DOM; create `<div id="game">` at runtime inside `boot()` and pass the **element reference** (not the string) to `Phaser.Game({ parent })`. The cascading `ScaleManager.resize → Cannot set properties of undefined (setting 'width')` errors all trace back to `game.canvas` never being created when either of these fail. |
| NineSlice won't shrink in landscape | Phaser's `NineSlice` silently clamps its minimum dimensions to `(leftWidth + rightWidth) × (topHeight + bottomHeight)` **in source pixels**. Symptom: one UI chrome element stays huge in landscape while every other `sd()`-driven element rescales correctly — because the requested `sd(H)` is below the inset total. Shrinking the insets fixes the scale clamp but stretches the art's rounded corners. The right fix: **operate the NineSlice in source-pixel space and scale it uniformly with `setScale(sd(1))`**. Keep `setSize(wSrc, hSrc)` in source px so the center stretches horizontally with text growth while corners stay intact; the `sd(1)` scale is what makes the whole object shrink in landscape, bypassing the min-dim clamp entirely. When reading `this.preview.width` (which is in scaled px) to decide `wSrc`, divide by `sd(1)` to convert back to source space. Tween callers that reset `setScale(1)` also need updating — the bg's base scale is now `sd(1)`, not 1. See [SelectionLine.ts](src/game/SelectionLine.ts) for the pattern. |

## IronSource — Runtime Analysis
IronSource requires every `_is.html` build to pass **LevelPlay → Creative Management → Playable Workshop** (Runtime Analysis / Playable Validator) before launch. Skipping this can get the ad disabled. The validator runs in an iOS-like WKWebView sandbox and exposes console errors — use it as a free diagnostic channel for iPhone-only failures when a Mac + Safari remote-debug isn't available.
