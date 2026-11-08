# 小芽生活小岛海洋生态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task; follow TDD and verification.

**Goal:** Incremental sand/grass/reef/caustic, grouped swimming fish, splash panic and semantic lighthouse beam.

**Architecture:** `fish-school.mjs` pure school model; `sea-art-glsl.mjs` one-pass seabed; `coastal-life.mjs` uniforms and tap adapter; `paper-kit.mjs` beam; `island.mjs` pointer/raycast and night control. No backend/data files touched.
**Tech Stack:** vendored Three.js r180, native ESM, Node.js tests, Playwright.
**Spec:** `docs/superpowers/specs/2026-11-08-xiaoya-ocean-ecology-gpt6.md`

## Global Constraints
- Isolated feature worktree, no merge or publish to remote main.
- No routing, schema, assets or Native V4 changes; mobile-lite and reduced motion.

## Review Focus
- Finger tap vs drag; lighthouse/day/object hit priority.
- School stays offshore; scare is bounded and recovers.
- WebGL shader compiles on Edge and WebKit; reef expensive path disabled on mobile.
- World rebuild disposes old sea and light correctly.
- No sound autoplay, private archive stays unchanged.

### Task 1: Pure fish school
- [x] Write failing `tests/fish-school.test.mjs`.
- [x] Verify missing module and shoal spacing RED.
- [x] Implement `createFishSchool(bounds,count)`: `sample(t)`, `scare(x,z,t)`, `diagnostics()`.
- [x] GREEN and preserve baseline tests.

### Task 2: Water art
- [x] Write failing `tests/sea-art.test.mjs`.
- [x] Implement independent seabed snippet with sand, clumped grass, reef, moving caustics and absorption.
- [x] Wire uniforms for fish and taps into existing `coastal-life.mjs`.
- [x] Inspect screenshots and remove over-dense first-pass grass stripes.

### Task 3: Semantically bound lighthouse
- [x] Write failing `tests/lighthouse-beam.test.mjs`.
- [x] Attach one lightweight translucent beam to current deadline lantern.
- [x] Switch on only at night; update with clock; never steal object picking.

### Task 4: Browser interactions & audit
- [x] Expose `seaAt` for deterministic world-to-screen QA; click only unclaimed sea.
- [x] Desktop, phone, night, reduced motion, WebKit QA; existing `qa-seaside` regression.
- [ ] True device iPhone Safari + human visual/art direction approval.
- [ ] Separate publication approval/merge; currently development branch only.
