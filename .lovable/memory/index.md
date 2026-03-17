Design system and UI constraints for all pages (except Index/homepage which stays dark).

- Theme: White background, gold borders (#C8A960), navy blue icons/primary (#1a3366)
- CSS tokens: --background: white, --border: gold (38 50% 80%), --primary: navy (220 70% 25%)
- All pages except Index force light mode via useEffect
- Index.tsx (homepage) stays dark mode — DO NOT TOUCH
- Sidebar tabs: 3-column grid layout with Lucide icons (h-5 w-5), no emojis
- Action toolbar: compact single-row bar under image with icon-only secondary buttons
- All Dialogs must use shadcn <Dialog> for Escape key support
- AI chat must hide raw control tags and render clean numbered options in Hebrew
- AI chat should include persistent "החל רקע" action
- When discussing colors → AI outputs [COLOR_PALETTE] with hex swatches
- When discussing textures → AI outputs [VISUAL_OPTIONS] with prompts and preview thumbnails
