# 小芽小岛海水生态 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task; follow TDD, verify output before any completion claims.

**Goal:** 让纸艺小岛拥有更丰富的浅海和可交互的鱼群，完整保留小芽业务与线上入口。
**Architecture:** 纯计算 fish-school.mjs + 独立 glsl shader snippet + 既有 coastal-life.mjs uniforms 接口 + island.mjs 水面点击接入。
**Tech Stack:** vendored Three.js r180、ES modules、node:test、Playwright。
**Spec:** docs/superpowers/specs/2026-11-08-xiaoya-ocean-ecology-design.md

## Global Constraints
不重构、不替换 Astro、不改数据键、Native V4、评委入口、原场景物件；手机 lite、reduced motion、基线功能均保持。

## Review Focus
- water click 与 day/goal 物件点击交叠，前者不能劫持后者；
- 拖动不能引发点击涟漪；
- reduced motion 下即使触摸也不应动画；
- dispose/recreate 不泄漏新 shader uniforms 或渲染对象；
- WebKit ShaderMaterial 编译及手机性能。

### Task 1 — Fish school pure model
**Files:** Create opus-original/fish-school.mjs + tests/fish-school.test.mjs
**Interface:** createFishSchool(bounds,count) => {sample(time),scare(x,z,time),diagnostics()}
- [x] Test deterministic outer-water positions; motion over time; finite output; fear response and decay; invalid land/outside clicks.
- [x] Run node --test tests/fish-school.test.mjs, confirm RED.
- [x] Implement minimal pure module and run GREEN.
- [x] Commit focused changes.

### Task 2 — Seabed shader and scene adapter
**Files:** Create opus-original/sea-art-glsl.mjs; modify coastal-life.mjs; add tests/sea-art.test.mjs.
**Interface:** seaArtFragment({fishCount,lite}) GL shader helper; water uniform fish positions/ripples updated by fishSchool.sample().
- [x] Write shader contract and deterministic tests, RED.
- [x] Add sand/grass/caustics shallow-only with sunset & nighttime, fish silhouette & tap ripple; integrate uniforms.
- [x] Run node tests plus WebGL/desktop & mobile checks, GREEN; correct any compilation failures.
- [x] Commit focused changes.

### Task 3 — Water pointer interaction
**Files:** Modify island.mjs and qa-seaside.cjs (if needed), add tests/water-interaction.test.mjs.
**Interface:** click water point -> coastalLife.tap(x,z,clock); water diagnostic exposes tap counts, fish state.
- [x] Write failing regression checks for click not touching island pick, drag does not trigger, reduced motion no ripple.
- [x] Raycast water plane only for unclaimed taps, convert to world-local coordinates with bounds.
- [x] Run unit/browser regressions; commit.

### Task 4 — Acceptance and handoff
**Files:** Update existing Opus README and existing QA evidence section if applicable.
- [x] Compare desktop + phone + night + reduced; ensure no uncaught shader errors or layout regressions.
- [x] Run pure test suite and repo route tests, inspect actual rendered screenshots.
- [x] Record verified scope and residual limits; keep branch isolated (no unauthorized publish).
