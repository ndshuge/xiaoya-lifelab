# Native V4 DAYFLOW Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, with red-green verification.

**Goal:** Preserve running Native V3, build a new V4 prioritizing today's schedule and suggestions, then route the unchanged contest URL to V4.

**Architecture:** Duplicate V3 files into sibling `native-v4/` while preserving existing `native-v3/`. Use a new `dayflow.mjs` to format genuine events and task/suggestion data, invoked by V4 `app.mjs`; keep `store.mjs` and shared model unchanged. Route changes only in original repo `index.html`, `versions/` and shared version switcher.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript ES modules, native dialog, existing custom components, Node tests, Playwright Edge/WebKit, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-02-xiaoya-native-v4-dayflow-design.md`.

## Global Constraints
- V3 tracked files must remain unchanged; no destructive Git operations.
- Original contest URL unchanged, `judge=1` preserved, same personal/demo storage and privacy behaviors.
- Do not fake calendar items or claim offline rules are real AI.
- Use shared CSS/DOM where possible; no React migration, no new third-party package.
- Verification against actual rendered 390px/1440px pages, including login-free judge flow.

## Review Focus
- On a day without saved courses/events, no synthetic schedule is invented and suggestion still actionable.
- Courses with recurring weeks or overlapping sessions still show accurate times and edit targets.
- Judge switch to personal mode never imports demo data.
- Navigation tasks stays reachable; mobile bottom navigation does not block last rows.
- Reduced-motion and rapid AI sheet open/close do not trap focus or input.

### Task 1 — Immutable copy and routing test
- Create failing `tests/qa-dayflow-v4.test.cjs` asserting V4 exists, V3 unmodified, root redirect points to V4, and switcher shows both V3/V4.
- Run RED; copy V3 tracked files to V4 without touching original; modify root route+navigation; run GREEN; commit.

### Task 2 — Today data presentation
- Create failing unit test `native-v4/qa-dayflow-data.mjs` for `buildTodayViewModel(d,time)` from `dayflow.mjs`: events chronological, next event based on clock, pending tasks, suggestion matching, empty day, no fake schedule.
- Implement formatter in new module without mutating `d`; integrate `todayView`; run browser test.

### Task 3 — Information hierarchy
- Create failing browser assertions: 4 primary mobile nav items, plan displays task inbox, goal list precedes growth generator, first fold includes next event and suggestion.
- Modify only V4 `index.html`, `app.mjs`, and `dayflow.css`.
- Run V4 tests and V3 original regression.

### Task 4 — Motion and accessibility
- Create failing browser assertions on active navigation indicator, quick chat accessibility, no viewport overflow, motion reduction.
- Add `dayflow-motion.css` or `dayflow.css` and minimal JS for nav indicator and chat overlay; avoid heavy layout thrash, support reduced-motion.
- Verify Edge desktop/mobile and WebKit, capture evidence screenshots.

### Task 5 — Release and judge smoke
- Run all relevant V4 tests, original V3 tests, original competition route tests and `git diff --check`.
- Fetch freshest `origin/main`; if concurrent writers advanced, reconcile rather than overwrite, rerun.
- Commit and push with restricted file prefixes using `_system/git-safe-https.ps1`; inspect live judge URL and both version paths.
## R2 · 2026-11-03 施工补充
- [x] 独立工作树继承未发布 V4，原 WIP 与 V3 未覆盖。
- [x] 三主导航、原级路由可达、防抖、dock 与小芽头像 RED→GREEN。
- [x] 无截止日期任务独立待办池 RED→GREEN；近日 DDL 提醒不伪造课程时段。
- [x] 浏览器 Edge、WebKit、iOS 输入缩放和 AI 授权回归。
- [ ] 发行前 fresh fetch + scope diff + non-force push + CI/线上 URL。
- [ ] iPhone Safari 真机交互触感验收。
