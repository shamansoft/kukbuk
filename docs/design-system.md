# MyKukBuk Design System

## Overview

The MyKukBuk extension features a **Culinary Editorial** design aesthetic that evokes warmth, sophistication, and a premium cooking experience. This design system moves away from generic tech blues toward an organic, food-focused visual language.

## Design Philosophy

**Key Characteristics:**
- Warm, appetizing colors inspired by cooking ingredients
- Editorial typography with serif display fonts
- Soft, organic shapes and rounded corners
- Generous spacing and clear visual hierarchy
- Atmospheric backgrounds with subtle textures
- Delightful micro-interactions and animations

## Color Palette

### Primary Colors
- **Terracotta** (`#d4724d`) - Primary action color, warmth, appetite
  - Light: `#e89474`
  - Dark: `#b85833`
- **Sage Green** (`#8a9a79`) - Secondary accent, natural, calming
  - Light: `#a8b899`
  - Dark: `#6b7960`

### Neutral Colors
- **Cream** (`#faf8f3`) - Primary background
  - Dark: `#f0ede5`
- **Charcoal** (`#2c2c2c`) - Primary text
  - Light: `#4a4a4a`

### Semantic Colors
- **Success** (`#7aa66d`) - Success states, confirmations
- **Error** (`#c8624f`) - Error states, warnings

## Typography

### Font Families
- **Display Font:** Crimson Pro (serif)
  - Used for: Headings, titles, emphasized text
  - Weights: 400, 600, 700
  - Character: Editorial, sophisticated, traditional

- **Body Font:** DM Sans (sans-serif)
  - Used for: Body text, buttons, UI elements
  - Weights: 400, 500, 600
  - Character: Clean, readable, modern

### Type Scale
- **Display (h1):** 26-36px, weight 700, Crimson Pro
- **Section Headings (h2):** 18-24px, weight 700, Crimson Pro
- **Body Text:** 15-16px, weight 400-500, DM Sans
- **UI Elements:** 14-15px, weight 500-600, DM Sans
- **Small Text:** 13-14px, weight 500, DM Sans

## Spacing System

Based on 4px increments:
- **XS:** 4px
- **SM:** 8px
- **MD:** 16px
- **LG:** 24px
- **XL:** 32px
- **2XL:** 48px

## Border Radius

- **SM:** 8px - Small elements, inputs
- **MD:** 12px - Cards, containers
- **LG:** 16px - Large cards, icons
- **XL:** 20px - Hero sections
- **FULL:** 999px - Pills, rounded buttons

## Shadows

```css
--shadow-sm: 0 2px 8px rgba(44, 44, 44, 0.08);
--shadow-md: 0 4px 16px rgba(44, 44, 44, 0.12);
--shadow-lg: 0 8px 32px rgba(44, 44, 44, 0.16);
--shadow-hover: 0 6px 24px rgba(212, 114, 77, 0.2);
```

## Animation & Motion

### Timing Functions
- **Fast:** 0.15s cubic-bezier(0.4, 0, 0.2, 1)
- **Base:** 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- **Slow:** 0.5s cubic-bezier(0.4, 0, 0.2, 1)

### Key Animations
- **fadeInUp:** Entry animation for sections
- **slideIn:** Decorative line animations
- **successPulse:** Success confirmation animation
- **errorShake:** Error state animation
- **subtlePulse:** Attention-drawing for primary actions
- **float:** Ambient background motion

### Motion Principles
1. **Staggered Delays:** Elements animate in sequence (0.1s-0.5s delays)
2. **Purposeful Movement:** Animations communicate state and hierarchy
3. **Subtle & Smooth:** Motion enhances without distracting
4. **Performance:** CSS-only animations for optimal performance

## Components

### Buttons

**Primary (Terracotta Gradient):**
- Background: Gradient from terracotta to terracotta-dark
- Hover: Lifts up with enhanced shadow
- Active: Ripple effect on click
- Use: Main actions (Save Recipe, Sign In)

**Secondary (White with Border):**
- Background: Semi-transparent white
- Border: Sage green
- Hover: Solid white with lift
- Use: Secondary actions (Settings, Change Folder)

**Danger (Error Gradient):**
- Background: Gradient from error color to dark variant
- Use: Destructive actions (Log Out)

### Inputs

- Border: 2px sage green (20% opacity)
- Focus: Terracotta border with glow effect
- Background: Semi-transparent white with blur
- Hover/Focus: Lifts slightly with enhanced shadow

### Cards

- Background: Semi-transparent white (80% opacity)
- Backdrop filter: 10px blur
- Border: 1px sage green (15% opacity)
- Hover: Lifts up, becomes more opaque
- Staggered entry animations

### Toggle Switches

- Off: Sage green (30% opacity)
- On: Terracotta gradient
- Smooth slide transition with shadow
- Focus ring on checked state

## Background Treatments

### Popup
- Linear gradient: Cream to cream-dark (135deg)
- Subtle radial gradients for depth (terracotta & sage at 3% opacity)

### Options Page
- Linear gradient: Cream to cream-dark (135deg)
- Floating ambient circles (800px & 600px)
- Gentle float animation (20-25s cycles)

## Accessibility

- **Contrast Ratios:** All text meets WCAG AA standards
- **Focus States:** Clear focus indicators on all interactive elements
- **Motion:** Respects prefers-reduced-motion (to be implemented)
- **Touch Targets:** Minimum 44x44px for all interactive elements

## Implementation Notes

1. **CSS Variables:** All design tokens defined in `:root`
2. **Google Fonts:** Imported via CDN (consider self-hosting for production)
3. **Browser Support:** Modern browsers with CSS Grid, backdrop-filter
4. **Performance:** Animations use GPU-accelerated properties (transform, opacity)

## Future Enhancements

- [ ] Add prefers-reduced-motion media query
- [ ] Consider self-hosting fonts
- [ ] Add dark mode variant
- [ ] Create reusable component library
- [ ] Implement loading skeleton states

---

**Design Aesthetic:** Culinary Editorial
**Last Updated:** January 2026
**Version:** 1.0
