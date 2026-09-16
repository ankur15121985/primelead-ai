# PRIMELEAD AI — Design Reference

Single source of truth for **fonts, languages, colors, sizes, spacing, and icons**
in the primelead project (`client/` React app + `server/` emails). Everything here is
extracted from the actual source files listed in §12.

---

## 1. Project snapshot

| Property | Value |
|---|---|
| Product name | **PRIMELEAD AI** — "AI-Powered CRM for Indian Businesses" |
| Stack | React 18 + TypeScript + Vite + Tailwind CSS 3.4 + Radix UI (shadcn-style) |
| UI libraries | `lucide-react` (icons), `framer-motion` (animation), `recharts` (charts), `class-variance-authority` + `tailwind-merge` (variants) |
| Theming | Light / Dark / System via `.dark` class on `<html>` (shadcn HSL token pattern) |
| Design language | Indigo-branded, white cards, 12px radii, soft shadows, pill badges |
| Dark mode | ✅ Fully implemented (full second token set) |
| Browser chrome color | `theme-color` meta = `#0f172a` |

---

## 2. Languages & localization

| Context | Value | Source |
|---|---|---|
| HTML document language | `lang="en"` | `client/index.html` |
| Charset / viewport | `UTF-8`; `width=device-width, viewport-fit=cover` | `client/index.html` |
| UI copy | English (hard-coded; no i18n framework) | — |
| Number/currency formatting | `Intl.NumberFormat('en-IN')` — INR `₹`, compact notation for short form | `client/src/lib/format.ts` |
| Date/time formatting | `toLocaleDateString('en-IN')` (e.g. `12 Aug 2026`); meetings use `en-US` weekdays | `format.ts`, `MeetingsPage.tsx` |
| AI content languages | **English, Hindi (हिन्दी), Hinglish** — selectable in AI follow-up writer | `LeadDetail.tsx`, `Features.tsx` |
| Supported-script copy | `'English · हिन्दी · Hinglish'` shown on Contact page | `pages/public/Contact.tsx` |

> Locale is India-first (`en-IN`) across currency, dates, and numbers; no runtime language switcher for the UI itself — only AI-generated content is multilingual.

---

## 3. Typography

### 3.1 Fonts

| Role | Stack |
|---|---|
| **UI / body (primary)** | `Inter, ui-sans-serif, system-ui, sans-serif` (`tailwind.config.js` → `fontFamily.sans`) |
| **Icons** | `lucide-react` SVG components (no icon font) |
| **Emails (server)** | `Inter, Arial, sans-serif` (inline styles) |

- **Inter** loaded from Google Fonts, weights **400, 500, 600, 700, 800** (`client/index.html`).
- Rendering: `antialiased` + `text-rendering: optimizeLegibility` on body; smooth scrolling (`scroll-behavior: smooth`); `-webkit-text-size-adjust: 100%`.
- Selection highlight: `bg-primary/20`.

### 3.2 Type scale (Tailwind sizes, 16px base)

| Element | Class / size | Weight | Extras |
|---|---|---|---|
| Marketing hero `h1` | `text-4xl sm:text-5xl lg:text-6xl` (36→60px) | `font-extrabold` | `tracking-tight`, `leading-[1.1]` |
| Page `h1` (app) | `text-2xl` (24px) | `font-bold` | `tracking-tight` (PageHeader) |
| Section `h2` (marketing) | `text-3xl sm:text-4xl` (30→36px) | `font-bold` | `tracking-tight` |
| `h2` (marketing small) | `text-xl`–`text-2xl` | `font-bold` | — |
| Card title `h3` | inherits (~16–18px) | `font-semibold` | `leading-tight tracking-tight` |
| Body default | `text-sm` (14px) / base 16px | 400 | — |
| Secondary text | `text-xs` (12px) | 400 | `text-muted-foreground` |
| Buttons | `text-xs`/`text-sm`/`text-base` by size | `font-medium` | — |
| Stat numbers | `text-2xl`–`text-3xl` (24–30px) | `font-bold` | often tone-colored |
| Big display numbers | `text-5xl` (48px, health scores), `text-4xl` (pricing), `text-6xl font-black` (marketing step numerals) | — | — |
| Badges | `text-[11px]` | `font-semibold` | `leading-4` |
| Card description | `text-sm` | 400 | `text-muted-foreground` |
| Auth headlines | `text-2xl font-bold tracking-tight` | — | — |

---

## 4. Color palette

Tokens are **HSL channel triplets** in CSS variables (`index.css`), mapped through
`tailwind.config.js` (`hsl(var(--token))`). Shadcn-style: each token has a paired
`-foreground`.

### 4.1 Light theme (`:root`)

| Token | HSL | ≈Hex | Usage |
|---|---|---|---|
| `--background` | `0 0% 100%` | `#ffffff` | Page background |
| `--foreground` | `222 47% 11%` | `#0f172a` (slate-900) | Primary text |
| `--card` / `--card-foreground` | `0 0% 100%` / `222 47% 11%` | `#fff` / `#0f172a` | Cards |
| `--primary` | `243 75% 59%` | `#6366f1` (indigo-500) | Brand, buttons, links, ring |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary |
| `--secondary` | `220 14% 96%` | `#f1f5f9` (slate-100) | Secondary buttons/bg |
| `--secondary-foreground` | `222 47% 11%` | `#0f172a` | — |
| `--muted` | `220 14% 96%` | `#f1f5f9` | Muted surfaces |
| `--muted-foreground` | `220 9% 46%` | `#64748b` (slate-500) | Secondary text |
| `--accent` | `243 75% 96%` | ≈`#eef2ff` (indigo-50) | Hover surfaces, active nav |
| `--accent-foreground` | `243 75% 45%` | `#4f46e5` (indigo-600) | — |
| `--destructive` | `0 72% 51%` | `#ef4444` (red-500) | Danger |
| `--success` | `152 76% 40%` | ≈`#059669` (emerald-600) | Success |
| `--warning` | `38 92% 50%` | `#f59e0b` (amber-500) | Warning |
| `--info` | `199 89% 48%` | ≈`#0284c7` (sky-600) | Info |
| `--border` / `--input` | `220 13% 91%` | `#e2e8f0` (slate-200) | Borders, inputs |
| `--ring` | `243 75% 59%` | `#6366f1` | Focus ring |
| `--radius` | `0.75rem` | 12px | Base radius |

### 4.2 Dark theme (`.dark`)

| Token | HSL | Usage |
|---|---|---|
| `--background` | `222 47% 6%` | ≈`#0b1220` page bg |
| `--foreground` | `210 40% 96%` | ≈`#f8fafc` text |
| `--card` | `222 47% 8%` | Card bg |
| `--secondary` / `--muted` | `217 33% 14%` | ≈slate-800 surfaces |
| `--muted-foreground` | `215 20% 55%` | Secondary text |
| `--accent` | `243 75% 15%` | Indigo-dark hover surface |
| `--accent-foreground` | `243 75% 80%` | — |
| `--destructive` | `0 62% 50%` | Danger (damped) |
| `--success` | `152 76% 36%` | — |
| `--warning` | `38 80% 45%` | — |
| `--info` | `199 80% 42%` | — |
| `--border` / `--input` | `217 33% 17%` | Borders/inputs |
| `--primary`, `--ring` | unchanged `243 75% 59%` | Brand stays indigo |

Theme switching: `ThemeProvider` persists `light|dark|system` in `localStorage('theme')`,
follows `prefers-color-scheme`, and toggles the class on `document.documentElement`.

### 4.3 Brand marks

| Asset | Colors |
|---|---|
| Favicon (`favicon.svg`) | `#4f46e5` rounded-square (rx 8) + white lightning bolt |
| Email wordmark | `PRIMELEAD` in `#0f172a` + `AI` in `#6366f1` |
| Nav logo icon | `Zap` lucide icon (brand/primary color) |

### 4.4 Lead status badge colors (light pastel style)

| Status | Background | Text | Border |
|---|---|---|---|
| `NEW` | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| `CONTACTED` | `bg-violet-50` | `text-violet-700` | `border-violet-200` |
| `QUALIFIED` | `bg-cyan-50` | `text-cyan-700` | `border-cyan-200` |
| `PROPOSAL` | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| `NEGOTIATION` | `bg-pink-50` | `text-pink-700` | `border-pink-200` |
| `WON` | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |
| `LOST` | `bg-slate-100` | `text-slate-600` | `border-slate-200` |

### 4.5 Priority badge colors

| Priority | Classes |
|---|---|
| `LOW` | `bg-slate-100 text-slate-600 border-slate-200` |
| `MEDIUM` | `bg-blue-50 text-blue-700 border-blue-200` |
| `HIGH` | `bg-amber-50 text-amber-700 border-amber-200` |
| `URGENT` | `bg-red-50 text-red-700 border-red-200` |

### 4.6 Generic Badge tones (shadcn pattern)

| Tone | Classes |
|---|---|
| `default` | `bg-secondary text-secondary-foreground` |
| `primary` | `bg-primary/10 text-primary border-primary/20` |
| `success` | `bg-success/10 text-success border-success/20` |
| `warning` | `bg-warning/15 text-warning-foreground border-warning/30` |
| `danger` | `bg-destructive/10 text-destructive border-destructive/20` |
| `info` | `bg-info/10 text-info border-info/20` |
| `muted` | `bg-muted text-muted-foreground` |

> Pattern: **10–15% opacity tint background + full-tone text + 20–30% border**. Score/health coloring uses `emerald-600` (≥80) / `amber-600` (≥60) / `red-600` (below).

### 4.7 Tailwind palette usage in pages

Raw Tailwind colors appear alongside tokens in feature pages: `text-gray-500/900`,
`text-slate-500/900`, `text-blue-600`, `text-purple-600`, `text-green-600`,
`text-indigo-600`, `text-red-600`, `text-amber-600`, `text-emerald-600`, `text-slate-200/70`
(decorative numerals). Prefer tokens for new work; these are page-level accents.

---

## 5. Sizing & spacing

### 5.1 Layout

| Property | Value |
|---|---|
| Container (Tailwind `container`) | centered, `padding: 1.5rem`, max `2xl: 1200px` |
| `.container-page` (app pages) | `max-w-6xl` (1152px), `px-4 sm:px-6` |
| Cards | `p-5` (20px) content, header `p-5 pb-3` |
| Marketing sections | `py-`-scaled Tailwind rhythm, `gap-`/`space-y-` utilities |
| Dialogs | Radix overlay + centered content card |
| Tables | `px-4 py-3` cells typical |

### 5.2 Radii

| Element | Value |
|---|---|
| `--radius` | `0.75rem` (12px) |
| `rounded-lg` (= `--radius`) | 12px — buttons, inputs |
| `rounded-md` | `calc(--radius - 2px)` = 10px |
| `rounded-sm` | `calc(--radius - 4px)` = 8px |
| Cards | `rounded-xl` (12px) |
| Badges/chips, spinner | `rounded-full` |
| Favicon square | rx 8 (of 32) |

### 5.3 Component sizes

| Component | Sizes |
|---|---|
| **Button** `sm` | `h-8 px-3 text-xs gap-1.5` (32px) |
| **Button** `md` (default) | `h-10 px-4 text-sm gap-2` (40px) |
| **Button** `lg` | `h-12 px-6 text-base` (48px) |
| **Button** `icon` | `h-10 w-10` |
| **Input / Select / Textarea** | `h-10 px-3 py-2 text-sm` (40px), full width |
| **Badge** | `px-2 py-0.5 text-[11px]` |
| **Avatar** (Radix) | sm sizes with fallback initials |
| **Spinner** (in button) | `h-4 w-4` border-2 |
| **Scrollbar** | 8px thin; thumb `bg-slate-300` / dark `bg-slate-600`, rounded-full |

---

## 6. Component variants & motion

- **Button variants**: `primary` (indigo + `shadow-sm shadow-primary/20`),
  `secondary`, `outline` (border-input, hover bg-accent), `ghost`, `destructive`, `success`.
  All: `rounded-lg font-medium`, `active:scale-[0.98]`, `disabled:opacity-50`,
  optional `loading` spinner, focus-visible ring.
- **Card hover**: `.card-hover` — `hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5` (200ms).
- **Keyframes** (tailwind.config.js): `fade-in` 0.35s ease-out (translateY 6px),
  `scale-in` 0.2s ease-out (0.97→1), `slide-in-right` 0.25s ease-out — used for page/dialog toasts & panels; `framer-motion` for marketing animations.
- **Focus (a11y)**: global `:focus-visible { outline-2 outline-offset-2 outline-ring }` — WCAG-noted in CSS.
- **Charts**: Recharts with token/palette colors; `chart-a11y.tsx` adds accessible chart wrappers.
- **Number inputs**: native spinners hidden globally.

---

## 7. Icons

| Concern | Detail |
|---|---|
| Library | **lucide-react** `^0.469.0` (stroke-based, `currentColor`) |
| Usage | Imported per-component: nav (Zap, Menu, X, Bell), CRM (Users, Building2, Phone, Mail, Target, Workflow, Bot, Sparkles, Webhook, QrCode, CreditCard…), status (CheckCircle2, AlertCircle) |
| Source meta map | `LEAD_SOURCES` in `lib/constants.ts` maps 21 channels → icon names (Globe, Facebook, Instagram, Send, MessageCircle, Ghost, Search, Store, PhoneCall, Briefcase, Building2, ShoppingBag, Zap, Webhook, Code2, FileSpreadsheet, QrCode, UserPlus…) |
| Emoji accents | Empty/feature states use emoji: 📊 🎯 📈 🔌 📦 ✅ 📄 👤 🏢 |
| Favicon | Custom SVG lightning bolt on indigo square (`/favicon.svg`) |
| Sizes | Typically `h-4 w-4` (inline), `h-5 w-5` (headers), `h-3.5 w-3.5` (dense) |

---

## 8. Emails (server-side, `server/src/lib/mailer.ts`)

| Property | Value |
|---|---|
| Font | `Inter, Arial, sans-serif` |
| Width / padding | `max-width: 520px`, centered, `padding: 24px` |
| Wordmark | 20px / 800, `#0f172a` + `#6366f1` accent |
| `h1` | 18px, `#0f172a` |
| Body | 14px, `#475569`, line-height `1.6` |
| Footer | 12px, `#94a3b8` |

---

## 9. Accessibility

- Full light/dark token parity; body text `#0f172a`/`#f8fafc` on neutral backgrounds (AAA-scale contrast).
- Keyboard focus: consistent `outline-ring` (indigo) via global `:focus-visible`.
- `@axe-core/playwright` wired into e2e suite (`playwright.config.ts`) for automated a11y checks.
- Icon-only buttons pair lucide icons with labels/tooltips (Radix Tooltip); decorative spinner is `aria-hidden`.
- `viewport-fit=cover` + safe-area for mobile PWA; web manifest linked.

---

## 10. Conventions

- **Styling**: Tailwind utility classes; `cn()` (clsx + tailwind-merge) for conditional classes.
- **Tokens**: HSL CSS variables only — never hardcode hexes in components; opacity modifiers (`/10`, `/20`) build tints.
- **Components**: shadcn-style primitives in `src/components/ui/*` (button, badge, card, dialog, input, select, table, tabs, tooltip, avatar, switch, skeleton, empty-state, page-header).
- **Meta constants**: label/color maps live in `src/lib/constants.ts` (single client mirror of server constants).
- **Naming**: PascalCase components, camelCase hooks/lib, kebab-case route slugs.

---

## 11. Comparison to Lead Finder (lead-scraper-web)

| Aspect | Lead Finder | PRIMELEAD AI |
|---|---|---|
| Brand color | `--primary #4f46e5` (indigo-600) | `--primary #6366f1` (indigo-500, one step lighter) |
| Font | Inter 400–800 | Inter 400–800 (same) |
| Base size | 15.5px | 16px (Tailwind default) |
| Card radius | 14px | 12px (`--radius 0.75rem`) |
| Dark mode | ❌ | ✅ light/dark/system |
| Badges | Hex pastel pills | Tailwind tint classes + token tones |
| Icons | Inline SVG + emoji | lucide-react + emoji |
| Locale | en (plain) | en-IN (₹, INR dates) + Hindi/Hinglish AI content |

---

## 12. Where each thing lives

| Concern | File |
|---|---|
| Design tokens (light+dark) | `client/src/index.css` |
| Tailwind mapping, fonts, radii, keyframes, container | `client/tailwind.config.js` |
| Font loading, meta, theme-color, title | `client/index.html` |
| Theme provider (light/dark/system) | `client/src/components/ThemeProvider.tsx`, `ThemeToggle.tsx` |
| UI primitives & sizes | `client/src/components/ui/*.tsx` (button, badge, card, input…) |
| Status/priority colors, sources, plans | `client/src/lib/constants.ts` |
| Currency/date formatting | `client/src/lib/format.ts` |
| Icons | `lucide-react` imports across `client/src` |
| Email styling | `server/src/lib/mailer.ts` (`layoutMail`) |
| Favicon | `client/public/favicon.svg` |
