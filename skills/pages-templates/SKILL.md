---
name: pages-templates
description: Composes React/Next.js pages and layout templates from the component library, following the UX designer's page and template structure. Invoked when the user says "build pages", "compose templates", "implement the layout", "turn this design into a Next.js page", "wire up the page structure", "scaffold Next.js routes from designs", "implement the template layer", or "build page from Figma". Keeps pages thin and pushes domain logic to the backend.
---

# Pages & Templates Skill

Compose the built React component library into layout templates and TanStack Start file-based routes that faithfully implement the UX designer's page/template structure. Routes are thin coordinators — they fetch data via typed loaders and delegate rendering to components. Domain logic lives in the backend or in dedicated service modules, never in routes.

## Process

### 1. Read the UX template structure

Before writing any code, read the UX designer's outputs:
- Inspect `design-system.md` for the template and page inventory.
- Use the Figma MCP read tools (`get_design_context`, `search_design_system`) via the **`figma`** companion plugin to inspect the **Templates** and **Pages** sections of the Figma file.
- Identify the layout regions (header, sidebar, main, footer), the component slots each region contains, and the responsive breakpoints specified in the design.

Map the Figma frame hierarchy to a TanStack Start route:

| Figma structure | TanStack Start output |
|---|---|
| `Templates / Dashboard Layout` | `src/templates/DashboardLayout.tsx` |
| `Pages / Dashboard` | `src/routes/dashboard.tsx` |
| `Pages / Settings` | `src/routes/settings.tsx` |

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

### 3. Implement TanStack Start routes

Routes are thin orchestrators. Their responsibilities:
- Declare the route via `createFileRoute` (file path = URL segment).
- Fetch data in the typed `loader` function; the component reads it via `Route.useLoaderData()`.
- Pass data as props to the template and components.
- Handle loading and error states with skeleton or error boundary components from the library.

```tsx
// src/routes/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '@/templates/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { getDashboardData } from '@/services/dashboard'; // backend service call

export const Route = createFileRoute('/dashboard')({
  loader: async () => getDashboardData(),
  component: DashboardPage,
});

function DashboardPage() {
  const { metrics, activity } = Route.useLoaderData();

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

For server-side logic that falls outside a loader (mutations, auth checks, third-party calls), use `createServerFn` from `@tanstack/react-start`:

```tsx
import { createServerFn } from '@tanstack/react-start';
import { getDashboardData } from '@/services/dashboard';

const fetchDashboard = createServerFn({ method: 'GET' }).handler(getDashboardData);
```

Domain logic (`getDashboardData`) lives in `src/services/` or the backend API — never inline in the route. The route is a thin coordinator; it does not compute, filter, sort, or transform domain data. See `principles-ddd`.

### 4. Map responsive breakpoints

Translate the Figma breakpoints to CSS / Tailwind responsive utilities. Common mapping:

| Figma breakpoint | Tailwind prefix | CSS media query |
|---|---|---|
| Mobile (≤ 640px) | (default) | — |
| Tablet (641–1024px) | `md:` | `@media (min-width: 641px)` |
| Desktop (≥ 1025px) | `lg:` | `@media (min-width: 1025px)` |

For layout shifts (sidebar collapses to bottom nav on mobile), implement with CSS media queries and token-based spacing — no JavaScript-driven layout switching unless the Figma design explicitly requires it.

### 5. Co-locate route tests (TDD — `principles-tdd`)

For each route and template, write tests before implementation:

```tsx
// src/routes/dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';

describe('DashboardPage', () => {
  it('renders the key metrics section', async () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/dashboard'] }) });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('region', { name: /key metrics/i })).toBeInTheDocument();
  });
});
```

Mock backend service calls (`getDashboardData`) via dependency injection or module mocks. Routes must be independently testable without a live backend.

### 6. Keep routes thin — enforce the boundary

Routes must NOT:
- Import domain models or aggregate types directly.
- Contain business rules (pricing calculations, authorization logic, validation).
- Call databases, external APIs, or file systems directly — use `createServerFn` or a backend service.
- Hold component state that belongs in a domain store or server.

If a route component grows beyond ~80 lines of logic, it is absorbing domain responsibility. Extract to a service, a custom hook, or a server function. See `principles-ddd`.

### 7. Validate before handoff

- `npx tsc --noEmit` — no TypeScript errors across templates and routes.
- `npx jest` — all route and template tests green.
- `npx vinxi build` — builds without error.
- Every Figma template/page in the design system has a corresponding TanStack Start route implementation.
- No domain logic in route files — grep confirms: `grep -rn 'calculate\|computePrice\|validateOrder' src/routes` returns nothing.
- Routes render correctly at each defined breakpoint (verify in Storybook or a local TanStack Start dev server).
