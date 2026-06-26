---
name: code-connect-impl
description: Implements Figma Code Connect mappings (*.figma.tsx) for the built React component library. Invoked when the user says "wire Code Connect to components", "implement figma.tsx mappings", "link React components to Figma", "publish Code Connect", "update code connect after component change", "validate figma.tsx files", or "Figma Dev Mode shows wrong snippets". Engineering counterpart to the figma-code-connect skill — operates on built components, not stubs.
---

# Code Connect Implementation Skill

Wire every built React component to its Figma counterpart by implementing `*.figma.tsx` mapping files. After publishing, Figma's Dev Mode shows live, accurate, copy-pasteable component code — not generated stubs. This is the engineering counterpart to `figma-code-connect` (which documents the mapping API); this skill operates against real, built components.

## Process

### 1. Confirm prerequisites

Ensure the React component library is built (see `react-component-library`) and the Code Connect CLI is available:

```bash
npx figma connect --help
# If missing, install as a dev dependency:
npm install --save-dev @figma/code-connect
```

Confirm `figma.config.json` (or `codeConnect` in `package.json`) is present:

```json
{
  "codeConnect": {
    "documentUrl": "https://www.figma.com/file/<FILE_ID>/...",
    "include": ["src/**/*.figma.tsx"]
  }
}
```

Create it if absent. The `documentUrl` is the URL of the Figma design file the UX designer built.

### 2. Discover components via Figma MCP

Use the official Figma MCP read tools (from the **figma@claude-plugins-official** companion plugin) to enumerate components that need mapping:

```
get_code_connect_map    → list existing Code Connect mappings; identify gaps
search_design_system    → enumerate all published components and component sets
get_design_context      → inspect a specific component's properties, variants, and layers
get_variable_defs       → confirm which token variables a component references
```

Cross-reference the Figma component list against `src/components/` to produce a gap list: components that exist in Figma but have no `*.figma.tsx` yet.

After implementing mappings and publishing, use `add_code_connect_map` to register the mapping in Figma if the CLI publish step does not cover it automatically.

### 3. Implement `*.figma.tsx` mapping files

For each Figma component, create a co-located `<ComponentName>.figma.tsx` next to the React implementation. Map every Figma property to the corresponding React prop:

```tsx
import figma from "@figma/code-connect";
import { Button } from "./Button";

figma.connect(Button, "https://www.figma.com/file/<FILE_ID>?node-id=<NODE_ID>", {
  props: {
    label:    figma.string("Label"),
    variant:  figma.enum("Variant", {
      Primary:     "primary",
      Secondary:   "secondary",
      Destructive: "destructive",
    }),
    disabled: figma.boolean("Disabled"),
    size:     figma.enum("Size", {
      Small:  "sm",
      Medium: "md",
      Large:  "lg",
    }),
  },
  example: ({ label, variant, disabled, size }) => (
    <Button variant={variant} size={size} disabled={disabled}>
      {label}
    </Button>
  ),
});
```

Property type mapping reference:

| Figma property type | Code Connect helper |
|---|---|
| Text / string layer | `figma.string("Layer Name")` |
| Boolean property | `figma.boolean("Prop Name")` |
| Variant / enum property | `figma.enum("Prop Name", { FigmaValue: "codeValue" })` |
| Instance swap slot | `figma.instance("Slot Name")` |
| Nested component | `figma.nestedProps("Component", { ... })` |
| Children slot | `figma.children("Slot Name")` |

Validate that every mapped prop name matches the React component's TypeScript interface exactly. If a Figma property has no React equivalent (e.g., a design-only annotation layer), exclude it from the mapping rather than mapping it to a no-op.

### 4. Validate locally

```bash
npx figma connect validate
```

Fix all reported mismatches:
- Node IDs that no longer exist in the Figma file (component was renamed or moved).
- Property names that changed in Figma or in the React component.
- Missing `$FIGMA_ACCESS_TOKEN` environment variable (required for validation that hits the Figma API).

Re-run until validation reports zero errors.

### 5. Publish

```bash
FIGMA_ACCESS_TOKEN=<token> npx figma connect publish
```

Confirm `FIGMA_ACCESS_TOKEN` is available in `.env`, shell environment, or CI secrets before running. On success, open the Figma file in Dev Mode and spot-check at least three components to confirm the correct React code snippet appears.

If the CLI publish does not register the mapping in the Figma file's Code Connect map, use the Figma MCP `add_code_connect_map` tool to register manually.

### 6. Keep mappings in sync

Re-run validation and publish after any of:
- A Figma component is renamed, restructured, or its properties change.
- A React component's prop API changes (name, type, or removed prop).
- New components are added to the design system.
- A `tokens.json` update changes a variant name that appears in an `enum` mapping.

Add a CI step to catch drift before it reaches production:

```yaml
# .github/workflows/figma-validate.yml
- name: Validate Code Connect
  run: npx figma connect validate
  env:
    FIGMA_ACCESS_TOKEN: ${{ secrets.FIGMA_ACCESS_TOKEN }}
```

### 7. Self-review checklist

- [ ] Every component in `src/components/` has a co-located `*.figma.tsx`.
- [ ] Every Figma component with `get_code_connect_map` returning no mapping now has one.
- [ ] `npx figma connect validate` exits zero.
- [ ] Spot-check in Figma Dev Mode: three or more components show correct, copy-pasteable code.
- [ ] No stale node IDs referencing deleted Figma components.
- [ ] CI validation step is wired.
