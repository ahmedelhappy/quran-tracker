---
name: Quran Tracker Design System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#404944'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#707974'
  outline-variant: '#bfc9c3'
  surface-tint: '#2b6954'
  primary: '#003527'
  on-primary: '#ffffff'
  primary-container: '#064e3b'
  on-primary-container: '#80bea6'
  inverse-primary: '#95d3ba'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#003623'
  on-tertiary: '#ffffff'
  tertiary-container: '#004f35'
  on-tertiary-container: '#51c695'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b0f0d6'
  primary-fixed-dim: '#95d3ba'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#0b513d'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  arabic-display:
    fontFamily: Amiri
    fontSize: 42px
    fontWeight: '400'
    lineHeight: '1.8'
  arabic-body:
    fontFamily: Amiri
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  section-gap: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

This design system is built upon the concept of "Spiritual Productivity." It bridges the gap between the disciplined organization of a productivity tool and the serene, sacred atmosphere of a place of worship. The brand personality is encouraging, patient, and reverent.

The design style is **Modern Minimalism with Tactile Spiritual Accents**. It utilizes heavy whitespace to reduce cognitive load during memorization, punctuated by high-quality typography and subtle geometric patterns. The emotional response should be one of "Muraqabah" (mindfulness)—a calm, focused state that transforms the act of tracking into an act of devotion.

Key aesthetic drivers:
- **Sacred Geometry:** Use of 8-point stars and repetitive patterns as low-opacity overlays (2-5% opacity) to add texture without distraction.
- **Progressive Disclosure:** Information is organized in a "Notion-like" hierarchy to keep the interface clean, using "Duolingo-inspired" gamification elements to maintain momentum.

## Colors

The palette is rooted in Islamic tradition but executed with modern accessibility standards. 

- **Primary Deep Teal (#064E3B):** Represents growth, nature, and the traditional color of the Quran’s binding. It is used for primary actions, active states, and navigation headers.
- **Secondary Gold/Amber (#D97706):** Symbolizes value and enlightenment. Reserved for achievement markers, streaks, and highlighting specific verses or "Ayat."
- **Background Light Cream (#FFFDF5):** Chosen to reduce eye strain during long reading sessions, offering a warmer, more organic feel than pure white.
- **Dark Mode (#111827):** A deep navy charcoal that maintains high contrast for night-time recitation while preserving the spiritual mood.

When transitioning between LTR and RTL, color logic remains consistent, but semantic meaning (e.g., "forward" arrows) must be mirrored.

## Typography

The design system employs a dual-font strategy to ensure harmony between English and Arabic scripts.

- **English:** `Inter` is used for its exceptional legibility in UI contexts. It provides a functional, modern contrast to the decorative nature of Arabic script.
- **Arabic:** `Amiri` or `Noto Naskh Arabic` is required. These fonts respect traditional calligraphy rules while remaining legible at smaller scales. Arabic text must always be set with a higher line-height (minimum 1.6) to accommodate diacritics (Tashkeel).

**RTL Implementation:** For Arabic-first layouts, the font size should be increased by approximately 20% relative to the English counterpart to maintain visual weight parity.

## Layout & Spacing

This design system utilizes a **12-column fluid grid** with an **8pt spacing rhythm**. 

- **Containers:** Content is housed in central containers with a maximum width of 1280px for desktop. On mobile, a 24px side margin is mandatory to maintain a sense of "breathability."
- **Rhythm:** All vertical spacing should be multiples of 8px. Use 16px for internal card padding and 24px for spacing between distinct UI modules.
- **RTL Logic:** When the layout switches to RTL, the grid column order is reversed. Margins and paddings defined as "left" or "right" must be implemented as "start" and "end" to ensure automatic mirroring.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Ambient Shadows**. This design system avoids harsh borders in favor of soft depth.

- **Shadows:** Use a custom "Sacred Shadow" style: a multi-layered, low-opacity shadow with a slight Teal tint (`rgba(6, 78, 59, 0.08)`) for light mode. This makes cards appear to lift gently off the cream background.
- **Layering:** 
    - Level 0: Background Cream (#FFFDF5).
    - Level 1: Surface White (#FFFFFF) for primary cards.
    - Level 2: Elevated elements like "Active Verse" or "Current Goal" with an ambient shadow.
- **Glassmorphism:** Use subtle backdrop blurs (12px) on navigation bars and sticky headers to maintain context of the scroll position without clutter.

## Shapes

The shape language is defined by **Generous Rounding**, reflecting the softness and approachability of the brand.

- **Base Radius:** 16px for all main container cards. This creates a friendly, modern "app-like" feel.
- **Interactive Elements:** Buttons use a slightly tighter 12px radius to appear more clickable and distinct from the cards they sit on.
- **Geometric Patterns:** Subtle Islamic geometric patterns (8-point star or arabesque) should be used as background masks on primary buttons or as header backgrounds, never exceeding 5% opacity to avoid interfering with text legibility.

## Components

### Buttons & Chips
- **Primary Button:** Deep Teal background, white text, 12px radius. On hover, a subtle shift to a slightly lighter emerald.
- **Secondary Button:** Gold/Amber background for "High Achievement" actions like "Finish Surah."
- **Chips:** Used for Surah names or Tags (e.g., "Madani", "Meccan"). These use 50% opacity of the primary teal with a 1px solid border.

### Verse Cards
The central component of the design system. 
- White surface, 16px radius, soft ambient shadow.
- Top section: Arabic text (Right-aligned by default).
- Bottom section: Translation (Left-aligned for English).
- Subtle 8-point star icon in the top corner indicating the "Ayah" number.

### Progress Rings (Duolingo Style)
- Circular progress indicators using the Gold/Amber color for "Percent Memorized."
- Use a thick stroke (8px) with rounded ends.

### Input Fields
- Soft cream background (#F3F4F6 for light mode) to distinguish from the white cards.
- 8px radius. Focus state uses a 2px Deep Teal ring.

### Navigation
- Bottom navigation for mobile with clear icons. 
- In RTL mode, the sequence of icons is mirrored (Home remains center, but left/right items swap).