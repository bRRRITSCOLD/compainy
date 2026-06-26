---
name: react-component-library
description: Builds a reusable, accessible, typed React/Next.js component library from design tokens and Figma designs. Invoked when the user says "build the component library", "implement these components", "create React components from tokens", "build a design-system component library", "scaffold components from Figma", "implement design tokens in code", or "add accessible components". Reads tokens.json (W3C DTCG) produced by the UX designer and maps Figma auto-layout to CSS flex/grid.
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

Or, for a Tailwind project, emit `tailwind.tokens.js` that extends `theme.colors`, `theme.spacing`, `theme.borderRadius`, and `theme.boxShadow` from the resolved token values.

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
      Button.tsx          # component implementation
      Button.types.ts     # prop types / interfaces
      Button.test.tsx     # co-located unit tests (TDD — tests first)
      Button.stories.tsx  # Storybook story
      Button.figma.tsx    # Code Connect mapping (see code-connect-impl)
      index.ts            # barrel export
  tokens/
    tokens.css            # generated CSS custom properties
    tailwind.tokens.js    # generated Tailwind theme extension (if applicable)
  index.ts                # public API barrel
```

Follow `principles-pragmatic-solid` interface segregation: the `index.ts` public API exports only what callers need. Internal helpers, token transforms, and test utilities are not re-exported.

### 4. Implement components — TDD first (`principles-tdd`)

For each component, follow the red/green/refactor cycle:

1. **Red**: Write `Button.test.tsx` asserting the expected rendered output, accessible role, and prop variations. Run — confirm failure.
2. **Green**: Implement `Button.tsx` with the minimum code to pass. Reference only token-based CSS vars or Tailwind classes derived from the token theme.
3. **Refactor**: Extract shared sub-patterns (e.g., a `useTokenClass` utility) only when they appear in three or more components.

Accessibility requirements (non-negotiable):
- Every interactive element has an appropriate ARIA role, label, or `aria-*` attribute.
- Focus indicators are visible and meet WCAG 2.1 AA contrast.
- Color is never the only differentiator (add icons, patterns, or text labels).
- Components accept and forward `className`, `style`, and all standard HTML attributes via rest-props spread.

Type all props with TypeScript interfaces in `Button.types.ts`. Export the interface from the barrel so consumers can import prop types without importing the component.

### 5. Write Storybook stories

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

### 6. Export a clean public API

The library's `src/index.ts` barrel must satisfy interface segregation (`principles-pragmatic-solid`): callers import only what they use.

```ts
// src/index.ts — public API
export { Button } from './components/Button';
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

### 7. Validate before handoff

- `npx tsc --noEmit` — no TypeScript errors.
- `npx jest` — all tests green.
- Storybook builds without error (`npx storybook build`).
- Every component in the Figma design system has a corresponding React implementation in `src/components/`.
- No hard-coded color, size, or shadow values — all visual values trace to a token.
- Pass the library path to `code-connect-impl` for Code Connect wiring.
