---
name: figma-code-connect
description: Maps Figma components to React code via Figma Code Connect. Invoked when the user says "set up Code Connect", "map component to code", "publish code connect", "Figma Code Connect", "link Figma to React", or "create figma.tsx mappings". Authors *.figma.tsx files, validates, and publishes so Figma's Dev Mode shows real component examples.
---

# Figma Code Connect Skill

Wire Figma components to their React counterparts using the official Figma Code Connect CLI. After publishing, Figma's Dev Mode shows live, accurate code snippets — not generated stubs — when an engineer inspects a component.

## Process

### 1. Install the Code Connect CLI

```bash
npx figma connect --help   # check if already available
# or install globally / as a dev dependency:
npm install --save-dev @figma/code-connect
```

Confirm the project has a `figma.config.json` (or `codeConnect` field in `package.json`) with `documentUrl` set to the target Figma file URL. Create it if absent:

```json
{
  "codeConnect": {
    "documentUrl": "https://www.figma.com/file/<FILE_ID>/...",
    "include": ["src/**/*.figma.tsx"]
  }
}
```

### 2. Discover components to map

Use the official Figma MCP (from the `figma@claude-plugins-official` companion) to enumerate the publishable components in the file:

```
search_design_system / get_design_context → list components and component sets
get_code_connect_map → see which Figma nodes already have a Code Connect mapping
```

Cross-reference against the React component library (search `src/components/**/*.tsx`). Identify gaps — components that exist in Figma but have no mapping file yet.

### 3. Author `*.figma.tsx` mapping files

For each Figma component, create a co-located `<ComponentName>.figma.tsx` file next to its React implementation. Follow the Code Connect API:

```tsx
import figma from "@figma/code-connect";
import { Button } from "./Button";

figma.connect(Button, "https://www.figma.com/file/<FILE_ID>?node-id=<NODE_ID>", {
  props: {
    label: figma.string("Label"),
    variant: figma.enum("Variant", {
      Primary: "primary",
      Secondary: "secondary",
      Destructive: "destructive",
    }),
    disabled: figma.boolean("Disabled"),
    size: figma.enum("Size", {
      Small: "sm",
      Medium: "md",
      Large: "lg",
    }),
  },
  example: ({ label, variant, disabled, size }) => (
    <Button variant={variant} size={size} disabled={disabled}>
      {label}
    </Button>
  ),
});
```

Map each Figma property type correctly:

| Figma property | Code Connect helper |
|---|---|
| Text / string layer | `figma.string("Layer Name")` |
| Boolean property | `figma.boolean("Prop Name")` |
| Variant / enum property | `figma.enum("Prop Name", { FigmaValue: "codeValue" })` |
| Instance swap | `figma.instance("Slot Name")` |
| Nested instance | `figma.nestedProps("Component", { ... })` |

### 4. Validate locally

```bash
npx figma connect validate
```

Fix any reported mismatches (node IDs that no longer exist, property names that changed). Re-run until validation is clean.

### 5. Publish

```bash
npx figma connect publish
```

This requires a `FIGMA_ACCESS_TOKEN` environment variable. Confirm the token is available (check `.env`, shell env, or CI secrets) before running. On success, open Figma Dev Mode and spot-check two or three components to confirm the correct code snippet appears.

### 6. Keep mappings in sync

After any of the following events, re-validate and re-publish:

- A Figma component is renamed, restructured, or its properties change.
- A React component's API (prop names / types) changes.
- New components are added to the design system.

A CI step (`npx figma connect validate` in the pipeline) catches drift before it reaches production. Add it to the project's CI workflow if not already present.
