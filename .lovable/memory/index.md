Design system: white bg, gold borders, navy icons — applied across all pages except Index.tsx (homepage).

- **RTL FIRST**: The entire site is in Hebrew. Global dir="rtl" is set on <html> and body.
- Email/URL/number inputs should use dir="ltr" for proper data entry.
- **Design tokens**: `--primary: 220 70% 25%` (navy), `--border: 38 50% 80%` (gold), `--background: 0 0% 100%` (white).
- **No emojis in tabs** — use Lucide icons only, colored with `text-primary`.
- **All Dialogs** must use shadcn `<Dialog>` (supports Escape natively). No manual div overlays.
- Shared export functions live in `src/lib/export-utils.ts` (generateSimplePDF, generateTIFF, triggerDownload, downloadBlob, canvasToBlob).
- AI chat must hide raw control tags (`[QUICK_REPLIES]`, `[YES_NO]`, etc.) and always render clean numbered options.
- AI chat should include a persistent "החל רקע" action accessible at every conversation stage.
- Keep all user-facing chat UX in Hebrew.
- When discussing colors → AI outputs `[COLOR_PALETTE]` with hex swatches the user clicks to confirm.
- When discussing textures/materials → AI outputs `[VISUAL_OPTIONS]` with prompts, auto-generates preview thumbnails.
