---
name: web-design-guidelines
description: Review and build UI code for Web Interface Guidelines and responsive design compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", "make responsive", or "check site against best practices".
metadata:
  author: vercel
  version: "1.1.0"
  argument-hint: <file-or-pattern>
---

# Web Interface & Responsive Design Guidelines

Comprehensive guidelines for modern web design, accessibility, responsiveness, focus management, animations, and typography.

## Core Rules & Principles

### 1. Responsive Layout & Mobile Ergonomics
- **Fluid & Adaptive Layouts**: Use responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3/4`) and flex layouts (`flex-col md:flex-row`).
- **Touch Targets**: Minimum hit area of 44×44px for touch interactions on mobile.
- **Horizontal Overflow Prevention**: Ensure containers use `overflow-x-hidden`, `min-w-0` on flex items, and tables have horizontal scroll wrappers (`overflow-x-auto custom-scrollbar`).
- **Drawer & Modal Responsiveness**: Full-width or bottom-sheet behavior on mobile (`w-full sm:max-w-md`), accessible close button.
- **Sticky Elements**: Sticky headers, bottom bars, or navigation must not occlude focused inputs or scrollable modals (`z-index` layering).

### 2. Accessibility & ARIA
- **Icon-only Buttons**: Always provide `aria-label` or `title` for assistive tech.
- **Form Controls**: Every interactive control must have an associated `<label>` (with `htmlFor`), wrapping label, or `aria-label`.
- **Keyboard Navigation**: Interactive custom controls need keyboard event listeners (`onKeyDown`/`onKeyUp` for `Enter`/`Space`).
- **Semantic HTML First**: Use `<button>` for actions, `<a>`/`<Link>` for navigation (avoid plain `<div onClick>`).
- **Decorative Elements**: Add `aria-hidden="true"` to purely decorative SVGs/icons.
- **Live Regions**: Asynchronous state updates, alerts, and toasts must use `aria-live="polite"` or `role="status"`.
- **Headings**: Maintain hierarchical order (`<h1>` → `<h6>`) and single `<h1>` per page view.

### 3. Focus States & Visual Feedback
- **Visible Focus**: Interactive elements must provide visible focus indicators (`focus-visible:ring-2 focus-visible:ring-blue-500` or equivalent).
- **Never Blank Outlines**: Never apply `outline: none` or `outline-none` without providing a focus replacement.
- **Focus-Within**: Group compound controls using `:focus-within` for clean container highlighting.

### 4. Forms & Input Ergonomics
- **Input Types & Attributes**: Use semantic input types (`email`, `tel`, `url`, `number`) and appropriate `inputmode`.
- **Autocomplete**: Explicit `name` and `autocomplete` attributes on standard form inputs.
- **Never Block Paste**: Do not attach `onPaste` with `preventDefault()`.
- **Spellcheck**: Disable spellcheck (`spellCheck={false}`) for codes, IDs, emails, usernames, EPIC numbers, etc.
- **Feedback & Submissions**:
  - Keep submit buttons enabled until action starts; show spinner + disable during active pending requests.
  - Display inline error messages directly alongside relevant inputs; focus the first error on validation failure.
  - Loading/placeholder text should end with ellipsis (`…`): `"Loading…"`, `"Saving…"`.

### 5. Animation & Micro-interactions
- **Reduced Motion**: Respect `prefers-reduced-motion` media queries (`motion-reduce:`).
- **GPU-Accelerated**: Animate `transform` and `opacity` only (avoid animating layout properties like `height`, `width`, `top`, `margin`).
- **Explicit Transitions**: Avoid `transition: all`; explicitly declare properties (e.g., `transition: opacity 150ms ease, transform 150ms ease`).
- **Responsive Timing**: Keep micro-interactions snappy (150ms–250ms).

### 6. Typography & Content Handling
- **Typographic Characters**: Use proper ellipsis (`…`) rather than three periods (`...`), curly quotes (`“` `”`), and non-breaking spaces where needed (`&nbsp;`).
- **Tabular Numbers**: Use `font-variant-numeric: tabular-nums` or `tabular-nums` for numeric alignment in tables, counters, and statistics cards.
- **Text Truncation**: Flex child elements must have `min-w-0` alongside `truncate` or `line-clamp-*` to prevent layout blowouts.
- **Empty States**: Render clean, stylized empty states for empty lists/tables instead of broken layout skeletons.

### 7. Performance & Assets
- **Images**: Explicit `width` and `height` on images to avoid Cumulative Layout Shift (CLS). Use `loading="lazy"` on below-the-fold assets.
- **Virtualization**: Large data lists (>100 items) should be paginated or virtualized.

---

## How to Review & Audit Files

When asked to review a component or file:
1. Check each section above against the target code.
2. Produce concise findings in `file:line` format with specific actionable recommendations.
3. Automatically apply recommended fixes to elevate design quality, responsiveness, and UX aesthetics.
