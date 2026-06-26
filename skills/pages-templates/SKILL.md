---
name: pages-templates
description: Composes React/Next.js pages and layout templates from the component library, following the UX designer's page and template structure. Invoked when the user says "build pages", "compose templates", "implement the layout", "turn this design into a Next.js page", "wire up the page structure", "scaffold Next.js routes from designs", "implement the template layer", or "build page from Figma". Keeps pages thin and pushes domain logic to the backend.
---

# Pages & Templates Skill

Compose the built React component library into layout templates and Next.js page routes that faithfully implement the UX designer's page/template structure. Pages are thin coordinators — they fetch or receive data and delegate rendering to components. Domain logic lives in the backend or in dedicated service modules, never in pages.

## Process

### 1. Read the UX template structure

Before writing any code, read the UX designer's outputs:
- Inspect `design-system.md` for the template and page inventory.
- Use the Figma MCP read tools (`get_design_context`, `search_design_system`) via the **figma@claude-plugins-official** companion plugin to inspect the **Templates** and **Pages** sections of the Figma file.
- Identify the layout regions (header, sidebar, main, footer), the component slots each region contains, and the responsive breakpoints specified in the design.

Map the Figma frame hierarchy to a Next.js route:

| Figma structure | Next.js output |
|---|---|
| `Templates / Dashboard Layout` | `src/templates/DashboardLayout.tsx` |
| `Pages / Dashboard` | `src/app/dashboard/page.tsx` (App Router) or `src/pages/dashboard.tsx` (Pages Router) |
| `Pages / Settings` | `src/app/settings/page.tsx` |

### 2. Build layout templates first

Templates are pure layout components — no data fetching, no business logic. They define the slot structure and pass children through:

```tsx
// src/templates/DashboardLayout.tsx
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

interface DashboardLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <Header />
      {sidebar && <aside className="dashboard-layout__sidebar">{sidebar}</aside>}
      <main className="dashboard-layout__main">{children}</main>
    </div>
  );
}
```

Use token-derived CSS classes or CSS custom properties for layout dimensions (grid columns, gap, padding). Do not hard-code pixel values — reference spacing and sizing tokens.

Apply `principles-ddd` bounded-context thinking: the template layer is a presentation concern. It knows nothing about domain concepts like `Order`, `User`, or `Product` — it only knows about layout slots and presentational component props.

### 3. Implement Next.js pages

Pages are thin orchestrators. Their responsibilities:
- Declare the route (file path = URL).
- Fetch or receive data via `getServerSideProps`, `getStaticProps`, React Server Components, or a data hook.
- Pass data as props to the template and components.
- Handle loading and error states with skeleton or error boundary components from the library.

```tsx
// src/app/dashboard/page.tsx (Next.js App Router)
import { DashboardLayout } from '@/templates/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { getDashboardData } from '@/services/dashboard'; // backend service call

export default async function DashboardPage() {
  const { metrics, activity } = await getDashboardData();

  return (
    <DashboardLayout>
      <section aria-label="Key metrics">
        {metrics.map(m => <MetricCard key={m.id} {...m} />)}
      </section>
      <ActivityFeed items={activity} />
    </DashboardLayout>
  );
}
```

Domain logic (`getDashboardData`) lives in `src/services/` or the backend API — never inline in the page. The page is a thin coordinator; it does not compute, filter, sort, or transform domain data. See `principles-ddd`.

### 4. Map responsive breakpoints

Translate the Figma breakpoints to CSS / Tailwind responsive utilities. Common mapping:

| Figma breakpoint | Tailwind prefix | CSS media query |
|---|---|---|
| Mobile (≤ 640px) | (default) | — |
| Tablet (641–1024px) | `md:` | `@media (min-width: 641px)` |
| Desktop (≥ 1025px) | `lg:` | `@media (min-width: 1025px)` |

For layout shifts (sidebar collapses to bottom nav on mobile), implement with CSS media queries and token-based spacing — no JavaScript-driven layout switching unless the Figma design explicitly requires it.

### 5. Co-locate page tests (TDD — `principles-tdd`)

For each page and template, write tests before implementation:

```tsx
// src/app/dashboard/page.test.tsx
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

describe('DashboardPage', () => {
  it('renders the key metrics section', async () => {
    render(await DashboardPage());
    expect(screen.getByRole('region', { name: /key metrics/i })).toBeInTheDocument();
  });
});
```

Mock backend service calls (`getDashboardData`) via dependency injection or module mocks. Pages must be independently testable without a live backend.

### 6. Keep pages thin — enforce the boundary

Pages must NOT:
- Import domain models or aggregate types directly.
- Contain business rules (pricing calculations, authorization logic, validation).
- Call databases, external APIs, or file systems directly.
- Hold component state that belongs in a domain store or server.

If a page grows beyond ~80 lines of logic, it is absorbing domain responsibility. Extract to a service, a custom hook, or a backend route handler. See `principles-ddd`.

### 7. Validate before handoff

- `npx tsc --noEmit` — no TypeScript errors across templates and pages.
- `npx jest` — all page and template tests green.
- `npx next build` — builds without error.
- Every Figma template/page in the design system has a corresponding Next.js implementation.
- No domain logic in page files — grep confirms: `grep -rn 'calculate\|computePrice\|validateOrder' src/app src/pages` returns nothing.
- Pages render correctly at each defined breakpoint (verify in Storybook or a local Next.js dev server).
