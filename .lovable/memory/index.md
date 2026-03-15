# Memory: index.md
Updated: now

Project interaction preferences and UI constraints learned from user feedback.
- **RTL FIRST**: The entire site is in Hebrew. Global dir="rtl" is set on <html> and body. All new components inherit RTL — do NOT add dir="rtl" per-component unless overriding.
- Email/URL/number inputs should use dir="ltr" for proper data entry.
- AI chat must hide raw control tags (`[QUICK_REPLIES]`, `[YES_NO]`, etc.) and always render clean numbered options.
- AI chat should include a persistent "החל רקע" action accessible at every conversation stage.
- Keep all user-facing chat UX in Hebrew.
- When discussing colors → AI outputs `[COLOR_PALETTE]` with hex swatches the user clicks to confirm.
- When discussing textures/materials → AI outputs `[VISUAL_OPTIONS]` with prompts, auto-generates preview thumbnails.
