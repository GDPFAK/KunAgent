---
id: design-system
name: Design system & craft
description: Brand-grade visual craft for design work — design-system-first thinking and anti-AI-slop rules.
---

# Design system & craft

Hold this bar on any visual work — HTML mockups, prototypes, real UI.

## 1. Design system is the source of truth
- If `.kun-design/DESIGN_SYSTEM.md` exists in the workspace, read it first and honor it: brand color, tone, type, radius, density, the named preset. It is the contract shared between the design canvas and the code.
- Derive every visual decision from tokens (color, spacing scale, radius, type scale), not ad-hoc values. Keep them consistent across the whole artifact.

## 2. Avoid generic AI tells
These read as "AI made this" — do not ship them:
- Cream / sand / beige default backgrounds; default to a deliberate neutral that fits the brand.
- Purple→blue diagonal gradients as a hero default.
- Bounce / elastic / overshoot easing. Use calm, short, standard easing.
- Endlessly nested cards (a card inside a card inside a card).
- Low-contrast gray text on colored or tinted backgrounds.
- Emoji as iconography in a serious product.

## 3. Craft baseline
- **Contrast & a11y**: verify text contrast (WCAG AA); never rely on color alone; provide a `prefers-reduced-motion` fallback for any animation.
- **Type**: a real type scale (not two sizes); generous line-height for body; tighten headings.
- **Spacing**: one spacing scale, applied rhythmically; align to a grid; let content breathe.
- **Hierarchy**: one clear focal point per view; size/weight/color do the work, not borders everywhere.
- **Motion**: purposeful and subtle; entrance/feedback only; respect reduced-motion.
- **Responsive**: design mobile and desktop intentionally, not just a squished desktop.

## 4. Output
- Single-file, self-contained HTML is the canvas format: inline CSS, real fonts, real components, no external build.
- Make it runnable as-is. Prefer system fonts or a single well-chosen web font.
- When the user iterates, change only what they asked for — keep the rest stable.
