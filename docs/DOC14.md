# DOCUMENT 14: UI/UX DESIGN SYSTEM

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Visual Identity](#2-visual-identity)
3. [Design Tokens](#3-design-tokens)
4. [Typography](#4-typography)
5. [Spacing and Layout](#5-spacing-and-layout)
6. [Component Standards](#6-component-standards)
7. [Interaction and Motion](#7-interaction-and-motion)
8. [Content and Microcopy](#8-content-and-microcopy)
9. [Mobile-First Rules](#9-mobile-first-rules)
10. [Accessibility Standards](#10-accessibility-standards)
11. [Screen Patterns](#11-screen-patterns)
12. [Design QA Checklist](#12-design-qa-checklist)

---

## 1. Design Principles

- Prioritize clarity over visual complexity.
- Optimize for non-technical users.
- Surface money and status prominently.
- Reduce steps for recurring tasks.
- Keep UI predictable across modules.

---

## 2. Visual Identity

- Tone: professional, practical, trustworthy.
- Style: clean cards, clear hierarchy, high contrast labels.
- Avoid visual noise and decorative overload.

---

## 3. Design Tokens

Suggested baseline:

```css
:root {
  --color-bg: #f7f8fb;
  --color-surface: #ffffff;
  --color-text: #1f2937;
  --color-muted: #6b7280;
  --color-primary: #0f766e;
  --color-primary-strong: #115e59;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --color-border: #e5e7eb;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
}
```

---

## 4. Typography

- Primary font: `Poppins` (or `Nunito Sans`) for readability in Indian SMB context.
- Body minimum size: 14px.
- Primary action text: 15-16px semibold.
- Use clear numeric formatting for rupee amounts.

---

## 5. Spacing and Layout

- Base grid: 8px scale.
- Card padding:
  - Mobile: 12-16px
  - Desktop: 16-24px
- Touch targets must be >= 44px height.

---

## 6. Component Standards

Core components:
- App header with property switcher
- KPI summary cards
- Tables/lists with filter chips
- Form fields with inline validation
- Status badges (`paid`, `unpaid`, `overdue`, etc.)
- Primary/secondary/danger buttons
- Modal and bottom-sheet variants

Rules:
- One primary action per screen.
- Use explicit labels, avoid icon-only actions for critical features.

---

## 7. Interaction and Motion

- Keep transitions subtle (150-250ms).
- Use progress indicators for async actions (save/upload/generate).
- Confirm irreversible actions with clear warning dialogs.

---

## 8. Content and Microcopy

- Use plain language, short sentences.
- Prefer action-oriented labels:
  - `Record Payment`
  - `Generate Receipt`
  - `Send Reminder`
- Error messages must tell users what to do next.

---

## 9. Mobile-First Rules

- Critical KPIs visible in first viewport.
- Avoid horizontal scrolling in tables; provide compact card views.
- Sticky primary action on key data-entry screens.
- Keep form steps short; chunk long forms.

---

## 10. Accessibility Standards

- Color contrast: WCAG AA minimum.
- Keyboard navigation for all desktop workflows.
- Screen reader labels for form controls and actionable icons.
- Error states announced and visually clear.

---

## 11. Screen Patterns

- Dashboard: KPI row -> alerts -> action list.
- Tenant list: search + filter chips + status badge + quick actions.
- Payment flow: due summary -> amount input -> method -> confirm.
- Maintenance board: tabbed statuses (`new`, `in-progress`, `resolved`).

---

## 12. Design QA Checklist

- [ ] Mobile layout validated at 360px width.
- [ ] Money values consistently formatted.
- [ ] Primary actions obvious and unambiguous.
- [ ] Empty/loading/error states implemented.
- [ ] Accessibility checks completed.

---

**Next Document:** DOC 15 - Definition of Done (DoD)

## End of Document 14

