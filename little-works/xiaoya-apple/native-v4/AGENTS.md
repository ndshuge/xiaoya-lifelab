# Xiaoya LifeLab / Native V4 — Product and frontend rules

Scope: `little-works/xiaoya-apple/native-v4/`, the **judge-facing app** in `ndshuge/xiaoya-lifelab`. This app is **小芽**, a student life and personal growth companion, **not 知序 AI 学院**.

## Product and information architecture
- Keep the three top-level destinations: **今天 / 事项 / 发展**. Inside 事项: real calendar events, dated deadlines, undated inbox. A deadline is **not** a scheduled study block. Inside 发展: mood/journal and goals. Preserve the single original Xiaoya avatar as the assistant entry.
- Minimize duplicate actions, repeated labels, inflated empty summaries and faux dashboard scores. A new task must remain quick; advanced fields are opt-in. Journal and mood are private local data; no automatic AI upload.
- Retain judge demo vs personal-mode separation, original V3 archive, data export/import, the mature growth route and explicit AI authorization.

## Apple-inspired design decisions — verified scope
- Apply **clarity, content-first hierarchy, predictable navigation, direct manipulation and restraint**. Preserve the original Xiaoya illustration and system/PingFang CJK typography. Use grouped rows/hairlines rather than stacks of look-alike cards.
- Material tiers: opaque content (L0), purposeful overlapping dock/dialog frost (L1), true optical displacement only when an actual licensed shader has been integrated **and proven across WebKit/Chromium** (L2). CSS `backdrop-filter` alone is **never L2**. Avoid double white haze or stacking independent scroll-edge effects.
- Interactive targets use **at least 44×44 CSS px** (as a web test approximation; not a claim of iOS native-point parity). 64×28 visible switches must have ≥44px *actual native input* hit height. Keep `:focus-visible`, associated labels, keyboard Escape, return focus and scroll unlock.
- Mood picker: one unified 5-option choice surface, never five separate decorated cards. Preserve labels, pressed state, and visible “未保存” feedback until the user commits the day’s journal; do not silently upload or autosave a private mood entry.
- Motion is functional: down/hold/release/cancel, opening and closing from the same origin, interruption, repeated taps and Reduced Motion. Avoid layout-shifting scale and independent motion of the dock.
- **Interactive hitbox stability:** do not animate `transform` on the live `#workspace` during navigation: the visual slide moved real input hitboxes 10px at the start of the transition. The old, inert painted snapshot may move; the new live view must keep final geometry from frame one. Assert this in `qa-v4-motion-dock.cjs`.
- **V4 navigation motion**: commit real DOM and active-tab state synchronously before WAAPI visual animation. Native `startViewTransition` schedules its DOM-update callback asynchronously and caused lost pages under rapid repeated taps. Outgoing snapshots must be `inert` / `aria-hidden`, strip IDs and delegated `data-*` attributes, clear after their 90–125ms exit, and never clone >600 descendant nodes. Preserve per-tab scroll memory and provide zero-animation Reduced Motion fallback. A visual snapshot must never count as a second functional page.
- Test iPhone safe area, browser toolbar, content underlay, open virtual keyboard, 200% zoom and long Chinese strings. **WebKit simulation is not real iPhone Safari**.

## ChatGPT plugin Skill provenance
Apple Web Design, SHUGE Apple Product Audit, SHUGE Apple Design, Apple Liquid Glass, Liquid Glass for Web, Motion, Frontend Dual Source, Design Taste, Finesse UI, Impeccable, Prism are Skills **mounted in the current ChatGPT plugin environment**. Read the ones applicable to the task using `skills__list` / `skills__read`; do **not** assume their files exist on Windows or pretend a plugin engine was installed merely because its Skill was read. PRISM/React and Liquid Glass optics are optional, not blanket dependencies.

## Implementation and release safeguards
- Canonical URL: `https://ndshuge.github.io/xiaoya-lifelab/?judge=1`. Root `index.html` routes to V4; do not change the URL, original V3 source or contest archives without explicit scope.
- Isolated feature worktree; do not edit another chat's dirty branch. Fetch current `origin/main`, selectively integrate verified changes, check staged diff and run both V4 and V3 regression suites. Ordinary **non-force** push only if authorized and remote ancestry is fresh. Verify the live judge page.
- Capture **actual before/after** desktop and mobile evidence; audit all routes, dialogs, toasts, errors, long lists, modes, keyboard focus and motion intermediate frames. A green test suite does not establish Apple visual fidelity or user approval.
- Full matrix and issue ledger: `docs/qa/2026-11-03-xiaoya-full-apple-product-audit.md`. Actual screenshots under `docs/qa/evidence/2026-11-03-xiaoya-ui/`. Pending iPhone Safari and active separate motion worktree remain explicitly unverified.
