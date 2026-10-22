# 小芽 LifeLab · Public UI Design System (2026-10-22)

The independent public GitHub Pages front end inherits the private application's established visual identity: cream canvas, leaf green, rounded cards, friendly sprout mascot. Do not copy another product's branding.

## References reviewed
- https://github.com/anthropics/skills/tree/main/skills/frontend-design — intentional visual hierarchy, meaningful labels, accessible failure states, responsive interaction.
- https://github.com/VoltAgent/awesome-design-md — design tokens and consistent design guidance.
These are reference frameworks, not third-party copied code or the original app's complete design system.

## Tokens
- Primary: #246743, #215c3e
- Surface: #fffdf7, #edf7ec
- Text: #244633
- Outline: #c9dbc9
- Radius: panels 20–25px, controls 10–14px
- Mobile: 390px viewport; modal scrolls within viewport, floating chat clear of bottom tab bar.

## Functional truths
- AI 未接入 when API connection has not been proven by an actual response; AI 已接入 only after successful model request.
- Opening any gated AI feature opens the connection experience, rather than silently disabling navigation.
- The first visit presents a choice: local rule-only features or optional API connection.
- The public Pages experience does not have a secure hosted API proxy. Attempts to connect from a browser are limited by the user's provider CORS settings; never imply guaranteed compatibility.
- On-screen key is not persisted, and must never enter localStorage, sessionStorage, repository files, the page URL, application logs, or screenshots.
- Offline chat replies are product-navigation guidance, not model output or claims of having read personal data.
- Feedback must be actionable if requests fail. Keep real chat history in the page session only.

## Validation
- Check clean-profile first-visit onboarding.
- Confirm non-AI workflow remains usable without key.
- Check every AI call-to-action opens config, and the chat panel opens independently.
- Verify desktop at 1440px and mobile at 390px, no global overflow, no overlay over fixed mobile navigation.
- Public script must parse successfully; GitHub Pages HTTP endpoints must work.
