---
name: pages-templates
description: Composes React routes and layout templates with TanStack Start from the component library, following the UX designer's page and template structure. Invoked when the user says "build pages", "compose templates", "implement the layout", "turn this design into a route", "wire up the page structure", "scaffold TanStack Start routes from designs", "implement the template layer", "build page from Figma", "add a form", "build a form", "tanstack form", "tanstack form useForm", "form validation", "nuqs", "url state", "query state", "useQueryState", "url search params", or "query params". Keeps routes thin and pushes domain logic to the backend.
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

For each route and template, write tests before implementation. Follow the `principles-tdd` tier naming: `*.unit.test.tsx` for isolated component rendering, `*.integration.test.tsx` for routes wired with a real (or in-memory) router, and `*.e2e.test.ts` for Playwright flows against localhost.

Route tests that render with a real router are integration-tier:

```tsx
// src/routes/dashboard.integration.test.tsx
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';

describe('DashboardPage', () => {
  beforeAll(async () => { /* seed any required state */ });
  beforeEach(async () => {});
  afterEach(async () => {});
  afterAll(async () => { /* clean up */ });

  it('renders the key metrics section', async () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/dashboard'] }) });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('region', { name: /key metrics/i })).toBeInTheDocument();
  });
});
```

Mock backend service calls (`getDashboardData`) via dependency injection or module mocks. Routes must be independently testable without a live backend. For full UI flows, write `*.e2e.test.ts` with Playwright against a running TanStack Start dev server.

### 5a. Build forms with TanStack Form (headless, shadcn-compatible)

Use `@tanstack/react-form` for all interactive forms in routes. It is headless (no built-in styles), so it composes cleanly with shadcn/ui primitives (unstyled Radix + Tailwind) — TanStack Form owns state and validation; the component library owns visual rendering.

Install once per project:

```bash
npm install @tanstack/react-form
```

#### Pattern — `useForm` + `form.Field` render prop

```tsx
// src/routes/signup.tsx (or a co-located form component)
import { useForm } from '@tanstack/react-form';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Button } from '@/components/Button';
import { createServerFn } from '@tanstack/react-start';

const submitSignup = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => {
    // Inline validator — a Zod schema adapter will replace this in issue #6
    const d = raw as { email: string; password: string };
    if (!d.email || !d.password) throw new Error('email and password are required');
    return d;
  })
  .handler(async ({ data }) => {
    // data is typed as { email: string; password: string } — domain service call here
  });

export function SignupForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await submitSignup({ data: value });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {/* Field-level validation */}
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) =>
            !value ? 'Email is required' : undefined,
          onBlur: ({ value }) => {
              if (!value) return undefined;
              return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                ? 'Enter a valid email'
                : undefined;
            },
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-1">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              type="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive" role="alert">
                {field.state.meta.errors.join(', ')}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) =>
            value.length < 8 ? 'Password must be at least 8 characters' : undefined,
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-1">
            <Label htmlFor={field.name}>Password</Label>
            <Input
              id={field.name}
              type="password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive" role="alert">
                {field.state.meta.errors.join(', ')}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Form-level subscription for submit button state */}
      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button type="submit" disabled={!canSubmit}>
            Sign up
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

#### Key API points

| Concept | API |
|---|---|
| Form instance | `useForm({ defaultValues, onSubmit })` |
| Field render prop | `<form.Field name="x">{(field) => …}</form.Field>` |
| Field value | `field.state.value` |
| Change handler | `field.handleChange(newValue)` |
| Blur handler | `field.handleBlur` |
| Field errors | `field.state.meta.errors` (string[]) |
| Form state | `<form.Subscribe selector={…}>{…}</form.Subscribe>` |
| Submit | `form.handleSubmit()` (called inside native `onSubmit`) |

#### Validation

Validators on `form.Field` accept `onChange`, `onBlur`, and `onSubmit` keys. Each receives `{ value }` and returns an error string or `undefined`. Validation is pluggable — a Zod schema adapter (`@tanstack/zod-form-adapter`) will be introduced in a later issue to replace inline validator functions with schema-driven validation.

#### Shadcn/ui compatibility note

shadcn/ui components (Radix primitives + Tailwind styling) are purely presentational — they have no opinion on form state. Bind TanStack Form's `field.state.value` to the input's `value` prop and `field.handleChange` to `onChange`; the components compose without any adapter layer. Error messages rendered from `field.state.meta.errors` follow the same visual style as shadcn's `<FormMessage>` — use `text-sm text-destructive` (or the `FormMessage` component if shadcn's `<Form>` wrapper is installed).

#### Test forms at the unit tier

```tsx
// src/routes/signup.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SignupForm } from './signup';

describe('SignupForm', () => {
  beforeAll(async () => {});
  beforeEach(async () => {});
  afterEach(async () => {});
  afterAll(async () => {});

  it('shows email format error after typing an invalid email and blurring', async () => {
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'notanemail' } });
    fireEvent.blur(screen.getByLabelText(/email/i));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email');
  });
});
```

### 5b. URL query-param state with nuqs

Use **nuqs** for ergonomic, type-safe URL search-param state owned at the component level. Filter dropdowns, pagination controls, tab switchers, and search inputs become bookmarkable and shareable with no boilerplate.

> **When to use which:** Use nuqs for component-local URL state (filters, tabs, pagination, search box). Use TanStack Router's native `validateSearch` + `Route.useSearch()` for route-contract params that loaders read.

#### Install

```bash
npm install nuqs
```

#### Adapter setup

nuqs requires a `NuqsAdapter` at the root of the React tree. The `nuqs/adapters/tanstack-router` adapter exists but is **experimental and does not yet cover TanStack Start**. Until official TanStack Start support lands, use the generic React SPA adapter in the root route:

```tsx
// src/routes/__root.tsx
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  ),
});
```

Once nuqs officially supports TanStack Start, swap to `nuqs/adapters/tanstack-router`.

#### Core hooks and parsers

```tsx
import {
  useQueryState,
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
  parseAsArrayOf,
  parseAsStringEnum,
} from 'nuqs';
```

**`useQueryState`** — single param, `useState`-style API synced to the URL:

```tsx
// ?search=foo
const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));

// ?page=2
const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

// ?active=true
const [active, setActive] = useQueryState('active', parseAsBoolean.withDefault(false));

// ?tab=overview  (constrained to a known set)
const [tab, setTab] = useQueryState(
  'tab',
  parseAsStringEnum(['overview', 'activity', 'settings'] as const).withDefault('overview'),
);

// ?tags=react,typescript  (multi-value; custom separator: parseAsArrayOf(parseAsString, '+'))
const [tags, setTags] = useQueryState('tags', parseAsArrayOf(parseAsString).withDefault([]));
```

**`useQueryStates`** — multiple params as one object; all updates land in a single history entry:

```tsx
const [filters, setFilters] = useQueryStates({
  search: parseAsString.withDefault(''),
  page:   parseAsInteger.withDefault(1),
  status: parseAsStringEnum(['open', 'closed', 'all'] as const).withDefault('all'),
});

setFilters({ page: 2 });                   // partial merge — other params unchanged
setFilters({ search: 'query', page: 1 }); // reset page when search changes
```

#### Parsers reference

| Parser | URL form | JS type | Notes |
|---|---|---|---|
| `parseAsString` | `?k=foo` | `string` | URL-decoded |
| `parseAsInteger` | `?k=42` | `number` | Integers only; invalid → `null` |
| `parseAsBoolean` | `?k=true` | `boolean` | Accepts `true` / `false` |
| `parseAsArrayOf(p)` | `?k=a,b` | `T[]` | Wraps any parser; separator configurable via `parseAsArrayOf(parser, separator)` |
| `parseAsStringEnum([…])` | `?k=val` | `'a'\|'b'\|…` | Rejects values outside the set |

Chain `.withDefault(value)` on any parser to eliminate `null` from the return type.

#### Example — filterable list

```tsx
function ProductList() {
  const [filters, setFilters] = useQueryStates({
    q:       parseAsString.withDefault(''),
    page:    parseAsInteger.withDefault(1),
    inStock: parseAsBoolean.withDefault(false),
  });

  return (
    <div>
      <input
        value={filters.q}
        onChange={(e) => setFilters({ q: e.target.value, page: 1 })}
        placeholder="Search…"
      />
      <label>
        <input
          type="checkbox"
          checked={filters.inStock}
          onChange={(e) => setFilters({ inStock: e.target.checked, page: 1 })}
        />
        In stock only
      </label>
      {/* pass filters.q, filters.inStock, filters.page to data-fetching hook */}
      <Pagination current={filters.page} onChange={(page) => setFilters({ page })} />
    </div>
  );
}
```

#### Test nuqs components with `NuqsTestingAdapter`

Wrap the component under test with `NuqsTestingAdapter` from `nuqs/adapters/testing` — no real router required:

```tsx
// src/routes/products.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { ProductList } from './products';

describe('ProductList', () => {
  beforeAll(async () => {});
  beforeEach(async () => {});
  afterEach(async () => {});
  afterAll(async () => {});

  it('resets page to 1 when the search query changes', async () => {
    const onUrlUpdate = vi.fn();
    render(
      <NuqsTestingAdapter searchParams="?page=3" onUrlUpdate={onUrlUpdate}>
        <ProductList />
      </NuqsTestingAdapter>,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'widget' } });
    // nuqs must have called onUrlUpdate, and the new query string must not carry page=3
    expect(onUrlUpdate).toHaveBeenCalled();
    expect(onUrlUpdate.mock.calls.at(-1)[0].queryString).toContain('page=1');
  });
});
```

#### nuqs vs TanStack Router native search — decision table

| Scenario | Tool |
|---|---|
| Loader fetches data keyed to a param (e.g. `/products?category=shoes`) | `validateSearch` + `Route.useSearch()` |
| Component-local filter, tab, search box, or pagination not read by a loader | nuqs `useQueryState` / `useQueryStates` |

### 6. Keep routes thin — enforce the boundary

Routes must NOT:
- Import domain models or aggregate types directly.
- Contain business rules (pricing calculations, authorization logic, or domain/business-rule validation). Note: UI-layer field validation (format checks, required fields) inside `form.Field` validators is allowed — only domain rules belong in the backend.
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
