# CogniSense — CDT Module Design Specification
## design.md | Version 1.0

---

## 1. Design Philosophy

The CogniSense design language is **"Clinical Luxury"** — the aesthetic tension between the rigor of medical science and the refinement of editorial design. It is neither a typical SaaS dashboard nor a cold medical interface. It is authoritative, calm, and beautiful.

The CDT Module must feel like a **natural extension** of the Speech Module already built. Every typographic choice, spacing token, color variable, and component pattern should be consistent. A user switching between the speech analysis page and the clock drawing page should feel like they never left the same product.

**Core design principles:**
1. **Contrast as hierarchy** — stark dark/light contrast carries information weight
2. **Serif + mono tension** — editorial display type meets clinical data labels
3. **Purposeful restraint** — negative space communicates confidence
4. **Green as life signal** — the accent color means "cognitive health"
5. **Dark cards = data density** — when information is serious, it gets dark treatment

---

## 2. Color System

All colors are defined as CSS custom properties on `:root`. Use these exclusively — no hardcoded hex values in components.

```css
:root {
  /* Backgrounds */
  --bg-base:         #EDEAE3;   /* Warm off-white — primary page background */
  --bg-surface:      #F5F2EB;   /* Slightly lighter card surface */
  --bg-dark:         #141A12;   /* Deep forest dark — primary dark card */
  --bg-dark-mid:     #1C2419;   /* Mid dark — secondary dark surfaces */
  --bg-dark-subtle:  #232E1F;   /* Subtle dark — hover states on dark cards */

  /* Typography */
  --text-primary:    #0F1410;   /* Near-black — primary body text */
  --text-secondary:  #4A4A40;   /* Warm grey — secondary descriptive text */
  --text-muted:      #8A8A7A;   /* Muted — labels, captions */
  --text-on-dark:    #E8E4DA;   /* Warm white — text on dark surfaces */
  --text-on-dark-muted: #8A9485; /* Muted green-grey — labels on dark */

  /* Accent — Cognitive Green */
  --accent-primary:  #5C8F68;   /* Main green — active states, scores, CTAs */
  --accent-light:    #7DB88A;   /* Light green — hover, secondary actions */
  --accent-italic:   #6FA876;   /* Italic green — display accents in headings */
  --accent-glow:     rgba(92, 143, 104, 0.15); /* Glow for score highlights */

  /* Risk Colors */
  --risk-low:        #5C8F68;   /* Green — Class 0: Normal */
  --risk-medium:     #C4A84F;   /* Amber — Class 1: SCD */
  --risk-high:       #C47A3A;   /* Orange — Class 2: MCI */
  --risk-critical:   #B04040;   /* Red — Class 3: High Risk */

  /* Canvas */
  --canvas-bg:       #FAF8F4;   /* Near-white — drawing surface */
  --canvas-stroke:   #1C1C18;   /* Near-black — patient's drawing strokes */
  --canvas-outline:  #C8C4B8;   /* Light grey — pre-drawn clock circle */
  --canvas-border:   #D4CFC5;   /* Subtle border around canvas */

  /* Borders & Dividers */
  --border-light:    rgba(0, 0, 0, 0.08);
  --border-dark:     rgba(255, 255, 255, 0.08);
  --divider:         #D8D4CB;

  /* Shadows */
  --shadow-card:     0 2px 16px rgba(0, 0, 0, 0.06);
  --shadow-dark:     0 4px 32px rgba(0, 0, 0, 0.32);
  --shadow-elevated: 0 8px 48px rgba(0, 0, 0, 0.12);
}
```

---

## 3. Typography

### Font Families

```css
/* Load via Google Fonts or self-hosted */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');

:root {
  --font-display:  'Cormorant Garamond', Georgia, serif;   /* Headlines, scores, hero text */
  --font-body:     'DM Sans', system-ui, sans-serif;       /* Body, labels, UI text */
  --font-mono:     'DM Mono', 'Courier New', monospace;    /* Data labels, IDs, timestamps */
}
```

**Rationale:** Cormorant Garamond matches the editorial serif visible in the speech module screenshots (high contrast thick/thin strokes, elegant x-height). DM Sans is modern, neutral, and clinical. DM Mono adds the data/scientific feel for metrics.

### Type Scale

| Token | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `--type-hero` | Display | 3.5rem / 56px | 500 | 1.1 | Score numbers, hero stat |
| `--type-display-xl` | Display | 2.5rem / 40px | 500 | 1.15 | Page titles |
| `--type-display-lg` | Display | 2rem / 32px | 400 | 1.2 | Section headings |
| `--type-display-italic` | Display Italic | 2rem / 32px | 400 | 1.2 | Italic accent in titles |
| `--type-heading` | Body | 1rem / 16px | 500 | 1.4 | Card headings |
| `--type-body` | Body | 0.9375rem / 15px | 400 | 1.6 | Body copy |
| `--type-label` | Mono | 0.6875rem / 11px | 500 | 1.4 | UPPERCASE tracked labels |
| `--type-data` | Mono | 0.875rem / 14px | 400 | 1.4 | Metric values, timestamps |
| `--type-small` | Body | 0.8125rem / 13px | 400 | 1.5 | Captions, helper text |

### Typography Rules

- **Section labels** (like "WHAT WE MEASURE", "PATIENT REGISTRY"): `font-mono`, `0.6875rem`, `letter-spacing: 0.12em`, `text-transform: uppercase`, `color: var(--text-muted)`
- **Score numbers**: `font-display`, `3.5rem+`, rendered in `var(--accent-primary)` or `var(--text-on-dark)` depending on card background
- **Page titles**: Mix of upright and italic display. Example: `"Clock <em>Drawing</em> Test"` — the italic word is in `var(--accent-italic)`
- **Body text on dark cards**: `var(--text-on-dark)` at `0.875rem`, `font-body`, weight 300
- **No bold on display text** — weight 500 is the heaviest used on serif headlines

---

## 4. Spacing & Layout System

```css
:root {
  /* Spacing scale (8px base) */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;
  --space-20:  80px;
  --space-24:  96px;

  /* Border radii */
  --radius-sm:   6px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   20px;
  --radius-pill: 999px;

  /* Max widths */
  --max-width-content: 1280px;
  --max-width-canvas:  640px;   /* CDT canvas max width */
  --max-width-narrow:  720px;   /* Form / result pages */
}
```

### Grid

- **Desktop**: 12-column grid, `max-width: 1280px`, `padding: 0 var(--space-8)`
- **Tablet (768px–1024px)**: 8-column grid, `padding: 0 var(--space-6)`
- **Mobile (<768px)**: Single column, `padding: 0 var(--space-4)`
- **Canvas area**: Centered, constrained to `var(--max-width-canvas)`, takes full viewport height on mobile minus navbar

---

## 5. Component Library

### 5.1 Navigation Bar

Identical to the Speech Module navbar:

```
Structure: [• CogniSense logo] — [HOME] [SPEECH] [CDT] [PROFILE] — [New Screening →]
```

- Background: `var(--bg-base)` with a 1px `var(--divider)` bottom border
- Logo: `font-display`, weight 500, `font-size: 1rem`
- Nav links: `font-body`, `0.75rem`, `letter-spacing: 0.08em`, `text-transform: uppercase`, `color: var(--text-muted)` — active link is `var(--text-primary)` weight 500
- CTA button: Black pill button (`background: var(--text-primary)`, `color: var(--bg-base)`, `border-radius: var(--radius-pill)`, `padding: 8px 20px`)
- Height: `56px` on desktop, `48px` on mobile

### 5.2 Page Header Pattern

Used on every module page:

```jsx
<section className="page-header">
  <span className="label-mono">CDT MODULE · VISUOSPATIAL</span>
  <h1 className="display-title">
    Clock <em>Drawing</em> Test
  </h1>
  <p className="body-description">
    Digitized visuospatial assessment capturing both final image 
    and drawing process dynamics.
  </p>
</section>
```

- Label: mono, uppercase, muted, with a `•` bullet prefix styled in `var(--accent-primary)`
- `<em>` in title: `font-style: italic`, `color: var(--accent-italic)` — no additional weight change

### 5.3 Drawing Canvas Card

The central component of the CDT Module. It is a **light card** (not dark) to maximize drawing visibility.

```
┌─────────────────────────────────────────────────┐
│  TASK INSTRUCTION                                │
│  Draw a clock face showing 10 minutes past 11   │
│                                                  │
│  ┌───────────────────────────────────────┐       │
│  │                                       │       │
│  │        [Pre-drawn clock circle]       │       │
│  │         Patient draws here            │       │
│  │                                       │       │
│  └───────────────────────────────────────┘       │
│                                                  │
│  [Undo] [Clear]          [00:42] [Submit →]      │
└─────────────────────────────────────────────────┘
```

Styling:
- Card: `background: var(--bg-surface)`, `border-radius: var(--radius-xl)`, `border: 1px solid var(--border-light)`, `box-shadow: var(--shadow-card)`
- Canvas background: `var(--canvas-bg)`, `border-radius: var(--radius-md)`, `border: 1.5px solid var(--canvas-border)`
- Pre-drawn clock circle: SVG overlay or drawn via Canvas API in `var(--canvas-outline)`
- Undo/Clear buttons: Ghost style — `border: 1px solid var(--border-light)`, `background: transparent`, `color: var(--text-secondary)`
- Timer: `font-mono`, monospaced digits, `color: var(--text-muted)` — turns `var(--risk-medium)` if > 3 min
- Submit button: Black pill CTA (same as navbar CTA)

### 5.4 Risk Score Card (Dark)

Displayed after submission. Mirrors the speech module's risk report card:

```
┌─────────────────────────────────────────────────┐  [dark bg]
│  CDT RISK SCORE · PATIENT #XXXX                  │
│                                                  │
│  62.4                                            │  [large green serif number]
│  Class 2 — Mild Cognitive Impairment             │  [small body text]
│                                                  │
│  Drawing Duration    ████████████░░  04:12       │  [progress bars]
│  Pause Ratio         ██████░░░░░░░░  0.38        │
│  Revision Count      ███░░░░░░░░░░░  3           │
│  Stroke Velocity     ████████████░░  84.2 px/s   │
│                                                  │
│  • Elevated pause ratio — planning hesitation    │
│  • High revision count — executive dysfunction   │
└─────────────────────────────────────────────────┘
```

Styling:
- Card: `background: var(--bg-dark)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-dark)`
- Score number: `font-display`, `3.5rem`, `color: var(--accent-primary)` — animate in with a count-up
- Class label: `font-body`, `0.875rem`, `color: var(--text-on-dark-muted)`
- Progress bars: `height: 3px`, background `rgba(255,255,255,0.08)`, fill color varies by risk level
- Flag bullets: `•` in `var(--accent-primary)`, text in `var(--text-on-dark)`, `font-body 0.875rem`
- Metric labels: `font-mono`, `0.6875rem`, uppercase, `var(--text-on-dark-muted)`

### 5.5 Feature Grid (6-Card Layout)

Below the main canvas, show a 2×3 or 3×2 grid of computed feature cards (light background):

Each card:
- Border: `1px solid var(--border-light)`
- Background: `var(--bg-surface)`
- Number index: `font-mono`, muted
- Icon: Simple emoji or lucide-react icon
- Title: `font-body`, `1rem`, weight 500
- Description: `font-body`, `0.875rem`, `var(--text-secondary)`
- Hover: Card with dark background `var(--bg-dark)`, text flips to light (CSS transition 200ms)

Features to show: Drawing Duration, Stroke Count, Revision Count, Pause Events, Mean Velocity, Velocity Variation

### 5.6 Patient Selector

Dropdown-style component at top of CDT page to select patient:

```
┌─────────────────────────────────────────────┐
│  SELECT PATIENT                              │
│  ┌─────────────────────────────────────┬──┐ │
│  │  Seema · 50y · Female               │ ↓│ │
│  └─────────────────────────────────────┴──┘ │
│  ID: P-MNDCK2A3 · Last session: 30 Mar 2026  │
└─────────────────────────────────────────────┘
```

### 5.7 Loading / Processing State

After submission, while scoring runs:

- Canvas fades to 30% opacity
- A centered spinner (animated SVG arc in `var(--accent-primary)`) overlays the card
- Text below spinner: `font-mono` "ANALYZING DRAWING..." with animated ellipsis
- Duration: max 3s (mock), then transition to result

### 5.8 Toast Notifications

- Position: bottom-right
- Success: Dark card (`var(--bg-dark)`), green left border `var(--accent-primary)`, white text
- Error: Dark card, red left border `var(--risk-critical)`, white text
- Duration: 4 seconds, slide-in from bottom

---

## 6. Page-by-Page Layouts

### 6.1 CDT Landing / Instruction Page (`/cdt`)

```
[Navbar]

[Page Header]
  Label: "• CDT MODULE · VISUOSPATIAL"
  Title: "Clock Drawing Test"  ← serif, italic "Drawing" in green
  Subtitle: Description text

[Patient Selector Card]

[Instruction Panel — 2-column]
  Left: Written instructions (3 steps with numbered indicators)
  Right: Illustration of a sample correct clock

[Start Test Button — full-width black pill]

[How This Works Section — 3 cards]
  Card 1: Static Analysis (ViT)
  Card 2: Dynamic Features (LSTM)  ← dark card (hovering)
  Card 3: Risk Score Fusion

[Footer]
```

### 6.2 Active Drawing Page (`/cdt/draw`)

```
[Navbar — minimal, no links, just logo + "Session Active" badge]

[Patient Info Bar — full width, subtle]
  "Seema · 50y · Female · ID: P-MNDCK2A3 · Session: #7"

[Canvas Card — centered, max 640px wide]
  [Task instruction text]
  [HTML5 Canvas]
  [Controls: Undo | Clear | Timer | Submit]

[Feature Live Preview — below canvas, 3-col grid]
  Stroke Count: 0    |    Duration: 00:00    |    Pauses: 0
  (Updates live as patient draws)
```

### 6.3 Result Page (`/cdt/result/:assessmentId`)

```
[Navbar]

[Breadcrumb: Patient Profiles > Seema > CDT Assessment #7]

[Two-column layout]
  Left (55%):
    [Dark Risk Score Card]
  Right (45%):
    [Submitted Clock Drawing Thumbnail]
    [Key Findings list]
    [Recommendation box]
    [Action buttons: View Profile | New Screening]

[Feature Detail Table — full width, light card]
  All computed dynamic features with values and normal ranges

[Brain Velocity Update Notice]
  "Brain Velocity updated: −125.0 pts/month"
```

---

## 7. Motion & Animation

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Page load | Staggered fade-up on cards | 400ms each, 80ms delay between | `ease-out` |
| Canvas first stroke | Subtle card border glow pulse | 600ms | `ease-in-out` |
| Submit button press | Scale down 0.97, then return | 120ms | `ease` |
| Processing overlay | Fade in | 250ms | `ease` |
| Score card reveal | Slide up + fade | 500ms | `cubic-bezier(0.16,1,0.3,1)` |
| Score number count-up | JS counter from 0 to value | 800ms | `ease-out` |
| Progress bars fill | Width 0% → value% | 600ms, 200ms delay | `ease-out` |
| Dark card hover | Background transition | 200ms | `ease` |
| Toast notification | Slide up from bottom | 300ms | `cubic-bezier(0.16,1,0.3,1)` |

---

## 8. Responsive Behavior

### Canvas on Mobile

- Canvas takes full viewport width minus `2 × var(--space-4)` padding
- Controls stack: timer + submit on one row, undo + clear on another
- Patient info bar collapses to single line with truncation
- Task instruction moves above canvas with reduced font size

### Result Page on Mobile

- Two-column layout stacks vertically (risk card → drawing thumbnail → findings)
- Feature table becomes a stacked list

### Breakpoints

```css
/* Mobile first */
/* sm: 640px */
/* md: 768px */
/* lg: 1024px */
/* xl: 1280px */
```

---

## 9. Iconography

Use **Lucide React** icons exclusively (same as Speech Module convention). Relevant icons:

| Context | Icon |
|---|---|
| Drawing/CDT | `PenLine` |
| Timer | `Timer` |
| Undo | `Undo2` |
| Clear/Reset | `RotateCcw` |
| Submit | Arrow in button text (→ Unicode) |
| Patient | `User` |
| Score | `Activity` |
| Warning flag | `AlertCircle` |
| Brain velocity | `TrendingDown` / `TrendingUp` |
| Pause events | `Pause` |

---

## 10. Design Consistency Checklist

Before shipping any component, verify against the Speech Module reference:

- [ ] Using `Cormorant Garamond` for all display text
- [ ] Using `DM Sans` for body text
- [ ] Using `DM Mono` for labels and data values
- [ ] Background is `var(--bg-base)` (#EDEAE3), not pure white
- [ ] Dark cards use `var(--bg-dark)` (#141A12)
- [ ] Green accent is `var(--accent-primary)` (#5C8F68)
- [ ] Section labels are UPPERCASE MONO TRACKED
- [ ] Page title includes an italic green accent word
- [ ] CTA buttons are black pill shape
- [ ] No blue, purple, or other accent colors anywhere
- [ ] Border radii use the `--radius-*` tokens
- [ ] All shadows use the `--shadow-*` tokens