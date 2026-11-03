# Xiaoya V4 Product UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace redundant global +, progressive task form, and reduce development/home page scroll without removing mature functions.
**Architecture:** Existing vanilla JS ES modules and dialog stay. Scope changes to V4 `app.mjs`, `items-view.mjs`, `development-view.mjs`, `dayflow-view.mjs`, `index.html`, and new `product-ux.css`. No shared schema changes.
**Tech stack:** Static HTML/CSS, ES modules, node:test, Playwright Edge/WebKit.
**Spec:** `docs/superpowers/specs/2026-11-03-xiaoya-product-ux-redesign.md`

## Task 1: Reproduce video failures as browser tests
- Create `native-v4/qa-product-ux.cjs` requiring no global header +, two-stage task composer and development segments.
- Run RED and inspect exact failing selectors.
## Task 2: Content-specific actions
- Remove global add button from `index.html`, page-heading + from Today/Items/Development; keep contextual buttons at deadline/undated/goal/calendar sections; replace vague "+" with action labels.
- Run relevant RED tests to GREEN.
## Task 3: Progressive reminder form and DDL semantics
- In `app.mjs` extend `editForm(kind,id='',preset={})` for tasks. Task title and due visible; advanced fields in closed `details` for new and expanded for edit.
- Date lane add `data-due-date=${selectedDate}`; click passes selected date `T23:59`. Independent inbox add has no preset. Keep `FormData` collecting advanced values, previous store version unchanged.
- Test new/date/inbox/edit/save/restore including empty due.
## Task 4: Split development by job, preserve draft
- Add developmentRecord/developmentGoals segment markup, `active` state, and event listener that toggles panels in place instead of re-rendering.
- `navigate('goals')` selects goals; normal "发展" defaults record. Growth open persists, save and reload restores journal, goal editing intact.
## Task 5: Reduce home duplication
- When all today schedule items are finished, collapse completed timeline in a details element instead of showing a second full schedule. With upcoming class, keep timeline visible. Preserve complete date labels and no fake events.
## Task 6: Real screenshot review, regression, publication
- 320/390/768/1440 snapshots and compare user recording frame states, modal with advanced closed/open, development tab states; inspect at least one round and fix.
- Full user-funnel tests (task create, due semantics, mode isolation, growth planner, avatar AI, backup, V3), WebKit.
- Fetch remote main; integrate independently; non-force push only matching tested file scopes; live URL smoke.
