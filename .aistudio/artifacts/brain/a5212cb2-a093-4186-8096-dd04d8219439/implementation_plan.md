# Green Botanical Palette Integration (Light & Dark Modes)

Integrate the user's curated 5-step green palette (`#1b5a3b`, `#56c565`, `#88d990`, `#bae6c1`, `#dff4e1`) into ThumbFeed, transforming the global design system into a cohesive, organic botanical aesthetic across both Light and Dark modes.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The palette comprises 5 harmonious green tones forming a natural tonal ramp:
> - `#1b5a3b` (Deep Forest Pine - shade 900)
> - `#56c565` (Vibrant Emerald / Meadow - mid-tone 600)
> - `#88d990` (Fresh Mint / Sage - accent 400)
> - `#bae6c1` (Soft Pastel Pistachio - surface/border 200)
> - `#dff4e1` (Light Celadon Wash - background wash 50)
>
> We have mapped these tokens to ensure WCAG AA accessibility (> 4.5:1 text contrast) and full aesthetic harmony in both light and dark modes.

- **Confirmed Decision 1: Light Mode Mapping**:
  - Canvas / Background: `#dff4e1` (Light Celadon wash)
  - Card & Modal Surfaces: `#bae6c1` (Pistachio surface) and `#ebf8ed` (Raised surfaces/inputs)
  - Primary Typography (Ink): `#1b5a3b` (Deep Forest Pine, yielding > 6.5:1 contrast against `#dff4e1`)
  - Accent / CTA Buttons: `#1b5a3b` with `#dff4e1` text, with `#56c565` secondary highlights
  - Borders & Hairlines: `rgba(27, 90, 59, 0.16)` and `#88d990`
- **Confirmed Decision 2: Dark Mode Mapping**:
  - Canvas / Background: `#0b1e14` (Deep forest midnight tint, derived from `#1b5a3b`)
  - Card & Drawer Surfaces: `#143825` (Card surface) and `#1b5a3b` (Raised controls/bars)
  - Primary Typography (Ink): `#dff4e1` (Celadon wash, yielding > 11:1 contrast against dark background)
  - Secondary Typography: `#bae6c1` (Soft sage text)
  - Accent / Primary CTA: `#56c565` (Vibrant emerald action buttons with `#0b1e14` ink)
  - Borders & Hairlines: `rgba(186, 230, 193, 0.20)` and `rgba(136, 217, 144, 0.35)`
- **Confirmed Decision 3: Migration of Hardcoded Classes**:
  - Remove all legacy hardcoded arbitrary color classes (`bg-[#0d0e10]`, `bg-[#D8DBE0]`, `text-[#0d0e10]`, `text-[#E6E8EC]`, etc.) in components like `ThumbnailModal.tsx`, `MoodboardDrawer.tsx`, `ThemeColorEditor.tsx`, and `TopBar.tsx`, replacing them with semantic tokens (`bg-canvas`, `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-2`, `border-line`, `bg-accent`, `text-on-accent`).

---

## 1. Overview & Core Concept

- **What It Does**: Transitions ThumbFeed from its previous monochrome slate/black palette to the user's fresh, organic green botanical palette. Every surface, card, button, modal, drawer, and input adapts responsively between light and dark themes.
- **Target Audience / Persona**: Creative visual designers, YouTube thumbnail curators, and content strategists seeking a focused, visually refined gallery workspace.
- **Key Value**: Provides an intentional, high-contrast, nature-inspired visual identity while maintaining strict typographic hierarchy, readability, and complete user control via the in-app Theme Editor.

---

## 2. User Experience & Visual Design

### Palette Tonal Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Light Mode                                                             │
│                                                                        │
│   Canvas: #dff4e1 (Lightest) ──────┐                                  │
│   Surface: #bae6c1                 ├──► Ink: #1b5a3b (High contrast)  │
│   Raised: #ebf8ed                  │    Accent: #1b5a3b / #56c565     │
│   Border: #88d990 / rgba(27,90,59) ┘                                  │
├────────────────────────────────────────────────────────────────────────┤
│ Dark Mode                                                              │
│                                                                        │
│   Canvas: #0b1e14 (Deep Night) ────┐                                  │
│   Surface: #143825                 ├──► Ink: #dff4e1 (Crisp Light)    │
│   Raised: #1b5a3b                  │    Accent: #56c565 (Vibrant Pop) │
│   Border: rgba(186,230,193,0.2)   ┘                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Visual Identity & Theme Tokens
- **Aesthetic Direction**: Natural botanical minimalism; warm organic greens with clean lines and generous spatial padding.
- **Typography & Hierarchy**:
  - Headings: Bold, deep forest green (`#1b5a3b` in light mode, `#dff4e1` in dark mode).
  - Body & Subtitles: `ink-2` (`rgba(27, 90, 59, 0.78)` in light mode, `rgba(223, 244, 225, 0.80)` in dark mode).
  - Subtle Metadata: Clean unboxed text with subtle middle-dot separators (`·`).
- **Interactive Feedback**:
  - Buttons: `#1b5a3b` in light mode (hovering to `#14462e`), `#56c565` in dark mode (hovering to `#45ab53`).
  - Active Pills: Deep forest green with light celadon text in light mode; vibrant emerald with dark forest text in dark mode.
  - Hover States: Gentle translucent veils (`--accent-veil`) and elevated shadow shifts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Semantic Token Architecture vs. Arbitrary Hex Injection**
  - *Chosen Approach*: Update root CSS variables in `src/app/globals.css` and replace scattered hardcoded arbitrary Tailwind classes (`bg-[#0d0e10]`, `text-[#D8DBE0]`, etc.) with semantic classes (`bg-surface`, `text-ink`, `border-line`).
  - *Why*: Ensures that changing light/dark mode instantly re-shades every component without visual bugs or stale dark/light patches.
  - *Alternatives Considered*: Injecting overrides only via JavaScript `themeColors.ts`. Rejected because initial page render would flash old colors before hydration.

- **Decision 2: Dark Mode Canvas Foundation**
  - *Chosen Approach*: Anchor dark mode canvas at `#0b1e14` (a deep, dark forest midnight), using `#143825` for surfaces and `#1b5a3b` for raised elements and cards.
  - *Why*: `#1b5a3b` has ~23% luminance; if used as the base background for the entire page in dark mode, cards and modals would lack depth layers. Grounding the canvas in `#0b1e14` allows `#1b5a3b` to serve as a rich, tactile surface layer while giving `#56c565` and `#88d990` luminous pop.

- **Decision 3: Update `FALLBACK` in `ThemeColorEditor.tsx`**
  - *Chosen Approach*: Update the reset fallbacks and default display values in `ThemeColorEditor.tsx` to reflect the new 5-step green palette so users can reset or tweak tokens based on the new palette defaults.

---

## 4. Technical Architecture & Implementation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      src/app/globals.css                    │
│  :root (Light)                │  .dark (Dark)               │
│  --canvas: #dff4e1            │  --canvas: #0b1e14          │
│  --surface: #bae6c1           │  --surface: #143825         │
│  --surface-raised: #ebf8ed    │  --surface-raised: #1b5a3b  │
│  --ink: #1b5a3b               │  --ink: #dff4e1             │
│  --accent: #1b5a3b            │  --accent: #56c565          │
│  --on-accent: #dff4e1         │  --on-accent: #0b1e14       │
│  --line: rgba(27,90,59,0.16)  │  --line: rgba(186,230,193)  │
└───────────────────────┬─────────────────────────────────────┘
                        │
       ┌────────────────┴────────────────────────┐
       ▼                                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  src/lib/themeColors.ts      │  │  src/components/             │
│  - FALLBACK values updated   │  │  - ThumbnailModal.tsx        │
│  - Storage presets aligned   │  │  - MoodboardDrawer.tsx       │
│  - Style injection sync      │  │  - TopBar.tsx                │
│                              │  │  - BottomSectionPill.tsx     │
│                              │  │  - ThemeColorEditor.tsx      │
└──────────────────────────────┘  └──────────────────────────────┘
```

### Planned File Changes

1. **`src/app/globals.css`**:
   - Reconfigure `:root` CSS variables for the light botanical palette.
   - Reconfigure `.dark` CSS variables for the deep evergreen dark mode.
   - Update `--shadow-card`, `--shadow-elevated`, and `--stage` color tokens to match the green hue.

2. **`src/lib/themeColors.ts` & `src/components/ThemeColorEditor.tsx`**:
   - Update `FALLBACK` color map to the new palette hex values.
   - Clear existing stale overrides or align storage defaults so existing users immediately see the new palette.

3. **Refactor Components with Hardcoded Color Values**:
   - `src/components/ThumbnailModal.tsx`: Replace `[#0d0e10]`, `[#D8DBE0]`, `[#E6E8EC]` with `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-2`, `bg-accent`, `text-on-accent`, `border-line`.
   - `src/components/MoodboardDrawer.tsx`: Replace hardcoded hexes with semantic Tailwind tokens.
   - `src/components/ThemeColorEditor.tsx`: Replace hardcoded badge and panel classes with semantic theme classes.
   - `src/components/TopBar.tsx` & `src/components/BottomSectionPill.tsx`: Verify all icons, active tabs, and button accents cleanly leverage the green system tokens.

---

## 5. Verification & Testing Plan

1. **Light Mode Verification**:
   - Verify page background is `#dff4e1`, cards are clearly legible, text is deep pine `#1b5a3b`, and buttons use accent tokens.
   - Confirm contrast meets WCAG AA standards.
2. **Dark Mode Verification**:
   - Switch to dark mode via top-bar theme toggle.
   - Verify dark atmospheric forest background, glowing emerald highlights (`#56c565`), and sharp readable celadon text (`#dff4e1`).
3. **Modal & Drawer Inspection**:
   - Open thumbnail detail modal and moodboard drawer; verify no orphaned grey/black boxes exist and backdrop blur blends smoothly.
4. **Theme Editor Compatibility**:
   - Open Theme Color Editor, test resetting to defaults, and verify live preview reflects the green botanical palette.
5. **Compilation & Linting**:
   - Run `lint_applet` and `compile_applet` to confirm zero syntax or build errors.
