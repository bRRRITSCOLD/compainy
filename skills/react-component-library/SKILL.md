---
name: react-component-library
description: Builds a reusable, accessible, typed React component library (framework-agnostic, used by TanStack Start apps) from design tokens and Figma designs. Invoked when the user says "build the component library", "implement these components", "create React components from tokens", "build a design-system component library", "scaffold components from Figma", "implement design tokens in code", "add accessible components", "style with tailwind", "use cva", "class-variance-authority", or "add component variants". Reads tokens.json (W3C DTCG) produced by the UX designer and maps Figma auto-layout to CSS flex/grid. Components are styled with TailwindCSS utility classes; variants are defined with cva (class-variance-authority); classes are merged with the cn() helper (clsx + tailwind-merge).
---

# React Component Library Skill

Build a reusable, accessible, type-safe React component library that is a faithful code mirror of the Figma design system. The library is framework-agnostic and designed to compose cleanly into TanStack Start routes and layout templates — no framework-specific imports, no RSC assumptions. `tokens.json` (W3C DTCG format, produced by the `figma-design-system` skill) is the single source of truth for all visual values — never hard-code a color, size, or shadow.

## Process

### 1. Consume `tokens.json`

Read `tokens.json` at the project root. It follows the W3C Design Tokens Community Group (DTCG) format:

```json
{
  "color": {
    "blue": { "500": { "$type": "color", "$value": "#3B82F6" } },
    "background": { "primary": { "$type": "color", "$value": "{color.blue.500}" } }
  },
  "fontSize": { "base": { "$type": "dimension", "$value": "16px" } },
  "spacing": { "4": { "$type": "dimension", "$value": "16px" } },
  "borderRadius": { "md": { "$type": "dimension", "$value": "8px" } },
  "shadow": { "sm": { "$type": "shadow", "$value": { "offsetX": "0px", "offsetY": "1px", "blur": "2px", "spread": "0px", "color": "#00000014" } } }
}
```

Transform tokens into CSS custom properties or a Tailwind theme extension. Resolve alias references (`{color.blue.500}`) before writing CSS vars:

```css
/* tokens.css — generated, do not edit by hand */
:root {
  --color-blue-500: #3B82F6;
  --color-background-primary: var(--color-blue-500);
  --font-size-base: 16px;
  --spacing-4: 16px;
  --border-radius-md: 8px;
}
```

For Tailwind projects (the default), emit `tailwind.tokens.js` that extends the Tailwind theme directly from resolved token values — design tokens are the single source of truth for Tailwind's theme:

```js
// tokens/tailwind.tokens.js — generated from tokens.json, do not edit by hand
// ESM module — requires "type": "module" in package.json (or rename to .mjs)
import { readFileSync } from 'fs';

const tokens = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url)));

// Convert camelCase DTCG token keys to kebab-case for Tailwind utility classes.
// e.g. "primaryHover" → "primary-hover" → bg-background-primary-hover resolves.
function toKebab(str) {
  return str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

/** @type {import('tailwindcss').Config['theme']} */
const tokenTheme = {
  colors: {
    blue: { 500: tokens.color.blue['500'].$value },
    background: Object.fromEntries(
      Object.entries(tokens.color.background).map(([k, v]) => [toKebab(k), v.$value])
    ),
    // After toKebab, keys become: "primary", "primary-hover"
    // → bg-background-primary, bg-background-primary-hover
  },
  spacing: {
    4: tokens.spacing['4'].$value,   // "16px"
  },
  fontSize: {
    base: [tokens.fontSize.base.$value, { lineHeight: '1.5' }],
  },
  borderRadius: {
    md: tokens.borderRadius.md.$value,
  },
  boxShadow: {
    sm: `${tokens.shadow.sm.$value.offsetX} ${tokens.shadow.sm.$value.offsetY} ${tokens.shadow.sm.$value.blur} ${tokens.shadow.sm.$value.spread} ${tokens.shadow.sm.$value.color}`,
  },
};

export default tokenTheme;
```

Reference it in `tailwind.config.ts`:

```ts
import tokenTheme from './src/tokens/tailwind.tokens';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: tokenTheme },
} satisfies import('tailwindcss').Config;
```

This means every Tailwind class (`bg-background-primary`, `rounded-md`, `shadow-sm`) resolves to a token — no hard-coded values in component files.

Validate that `tokens.json` is well-formed JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('tokens.json','utf8'))" && echo "tokens.json valid"
```

Note: this command checks JSON syntax only. Resolving `{...}` alias references (e.g. `{color.blue.500}`) requires a token transform tool such as Style Dictionary, or a script that walks `$value` fields and resolves each alias against the token tree.

### 2. Map Figma auto-layout to flex/grid

For each component noted in `design-system.md` (auto-layout intent from the UX designer):

| Figma auto-layout property | CSS output |
|---|---|
| Direction: Horizontal | `flex-direction: row` |
| Direction: Vertical | `flex-direction: column` |
| Spacing mode: Packed | `justify-content: flex-start` |
| Spacing mode: Space between | `justify-content: space-between` |
| Align: Center | `align-items: center` |
| Gap | `gap: var(--spacing-N)` (map to nearest spacing token) |
| Padding | `padding: var(--spacing-N)` per side |
| Wrap: On | `flex-wrap: wrap` |
| Figma Grid layout | `display: grid` with appropriate `grid-template-columns` |

Reference the spacing tokens directly; do not embed pixel values.

### 3. Scaffold the library structure

```
src/
  components/
    Button/
      Button.tsx                    # component implementation
      Button.types.ts               # prop types / interfaces
      Button.unit.test.tsx          # co-located unit tests (TDD — tests first)
      Button.stories.tsx            # Storybook story
      Button.figma.tsx    # Code Connect mapping (see code-connect-impl)
      index.ts            # barrel export
  tokens/
    tokens.css            # generated CSS custom properties
    tailwind.tokens.js    # generated Tailwind theme extension (Tailwind is the default)
  index.ts                # public API barrel
```

Follow `principles-pragmatic-solid` interface segregation: the `index.ts` public API exports only what callers need. Internal helpers, token transforms, and test utilities are not re-exported.

### 4. Style components with Tailwind + cva

Install the styling utilities once per project:

```bash
npm install tailwindcss clsx tailwind-merge class-variance-authority
```

Create a `cn()` helper for safe class merging (handles conditional classes and Tailwind class conflicts):

```ts
// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Define component variants with `cva`. Each variant maps a prop value to a set of Tailwind classes derived from the token-seeded theme:

```ts
// src/components/Button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  // base classes — always applied
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-background-primary text-white hover:bg-background-primary-hover',
        secondary: 'border border-current bg-transparent hover:bg-background-primary/10',
        ghost:     'bg-transparent hover:bg-background-primary/10',
      },
      size: {
        sm: 'h-8  px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

Key rules:
- All class names in `cva` must correspond to a Tailwind token key (colors from `tailwind.tokens.js`, spacing, etc.) — never raw hex values or `px` literals.
- Accept `className` on every component and merge it last via `cn()` so callers can add one-off overrides without breaking the variant system.
- Export `buttonVariants` alongside the component so other components can compose the same class logic without importing the JSX element.

### 5. Implement components — TDD first (`principles-tdd`)

For each component, follow the red/green/refactor cycle:

1. **Red**: Write `Button.unit.test.tsx` asserting the expected rendered output, accessible role, and prop variations. Run — confirm failure. (Use `*.unit.test.tsx` for isolated component tests — see `principles-tdd` for the full unit/integration/e2e tier conventions.) Name every `it(...)` in `Subject_Scenario_Expectation` form (see `principles-tdd` **Test naming** section):

```tsx
// src/components/Button/Button.unit.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  beforeAll(async () => {});
  beforeEach(async () => {});
  afterEach(async () => {});
  afterAll(async () => {});

  it('Button_PrimaryVariant_RendersWithPrimaryClasses', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('bg-background-primary');
  });

  it('Button_DisabledState_DisablesPointerEvents', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
```

2. **Green**: Implement `Button.tsx` with the minimum code to pass. Reference only token-based CSS vars or Tailwind classes derived from the token theme.
3. **Refactor**: Extract shared sub-patterns (e.g., a `useTokenClass` utility) only when they appear in three or more components.

Accessibility requirements (non-negotiable):
- Every interactive element has an appropriate ARIA role, label, or `aria-*` attribute.
- Focus indicators are visible and meet WCAG 2.1 AA contrast.
- Color is never the only differentiator (add icons, patterns, or text labels).
- Components accept and forward `className`, `style`, and all standard HTML attributes via rest-props spread.

For form input components (`Input`, `Textarea`, `Select`), validation is the caller's responsibility — validation schemas are zod; see the `pages-templates` skill for wiring TanStack Form validators and `createServerFn` to a shared zod schema.

Type all props with TypeScript interfaces in `Button.types.ts`. Export the interface from the barrel so consumers can import prop types without importing the component.

### 6. Write Storybook stories

Co-locate a `*.stories.tsx` file with each component. Cover:
- Default state
- All variant combinations (size × variant × state)
- Accessibility story (keyboard navigation, screen-reader labels)
- Dark-mode / themed variant if the design system supports it

Run Storybook locally to spot-check visual fidelity against the Figma designs:

```bash
npx storybook dev -p 6006
```

Use the official Figma MCP read tools (`get_design_context`, `search_design_system`) via the **`figma`** companion plugin to inspect the live Figma design and confirm pixel-level alignment with the implementation.

### 7. Export a clean public API

The library's `src/index.ts` barrel must satisfy interface segregation (`principles-pragmatic-solid`): callers import only what they use.

```ts
// src/index.ts — public API
export { Button, buttonVariants } from './components/Button';
export type { ButtonProps } from './components/Button';
export { Card } from './components/Card';
export type { CardProps } from './components/Card';
// ... one export block per component
// Do NOT export internal utilities, test helpers, or token transforms
```

Run the test suite before marking the library ready for integration:

```bash
npx jest --passWithNoTests
```

All tests must be green. No skipped tests without a documented reason.

### 8. Validate before handoff

- `npx tsc --noEmit` — no TypeScript errors.
- `npx jest` — all tests green.
- Storybook builds without error (`npx storybook build`).
- Every component in the Figma design system has a corresponding React implementation in `src/components/`.
- No hard-coded color, size, or shadow values — all visual values trace to a token.
- Pass the library path to `code-connect-impl` for Code Connect wiring.
