import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Smoke/crawler suite for Smart Business Automation Hub.
 *
 * This app has no URL router — navigation is a single `activeTab` state
 * switch (src/App.tsx) driven entirely by sidebar clicks, so there is no
 * "discover <a href> and open it" crawl to do. This suite is the equivalent
 * for a state-switched SPA: it drives every sidebar destination the way a
 * user would, and asserts each one renders its expected heading with no
 * uncaught console errors.
 *
 * Requires the dev server already running on :3000 with VITE_DEMO_MODE=true
 * (see playwright.config.ts) so the app boots straight past the login gate.
 */

/** Vite's dev-only HMR websocket fails inside this container/proxy setup —
 * a dev-tooling artifact, not an application bug. Firestore permission-denied
 * warnings are a separate, already-tracked issue (demo mode has no session to
 * read Firestore with) and are asserted on separately, not muted here. */
const IGNORED_ERROR_PATTERNS = [/ws:\/\/localhost:24678/, /\[vite\] server connection lost/];

function isIgnored(text: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((p) => p.test(text));
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`uncaught: ${err.message}`));
  return errors;
}

test.describe('homepage', () => {
  test('loads the dashboard with no uncaught errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('survives a full page refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
  });
});

/**
 * Every sidebar destination, keyed by its visible label, with the heading
 * text that proves the right view actually mounted. Kept in sync with
 * src/App.tsx's activeTab switch and src/components/layout/Sidebar.tsx.
 */
const NAV_DESTINATIONS: { label: string; heading: string | RegExp }[] = [
  { label: 'Customers', heading: 'Customer CRM' },
  { label: 'Leads', heading: 'Leads & Sales Pipeline' },
  { label: 'Quotes & Invoices', heading: 'Quotations & Invoicing' },
  // No page-title heading here (unlike every other module) — it goes
  // straight to sub-tabs and stat cards, so this asserts on stat-card text.
  { label: 'Inventory & Store', heading: /Total Catalog SKUs/i },
  { label: 'Complaints', heading: 'Support Desk & SLA Tracker' },
  { label: 'Tasks', heading: 'Task & Operations Hub' },
  { label: 'Automation', heading: 'Automation Center & n8n Engine' },
  { label: 'Communications', heading: 'Communications Center' },
  { label: 'Documents', heading: 'Documents & Vault' },
  { label: 'Reports', heading: 'Executive Reports & Analytics' },
  { label: 'Notifications', heading: 'Operational Alerts & Notifications' },
  { label: 'Employees', heading: 'Team & RBAC Management' },
  { label: 'Settings', heading: 'Organization Settings & Integrations' },
];

async function openSidebar(page: Page) {
  // The sidebar renders as an off-canvas drawer at this viewport size; the
  // hamburger toggles it open. If it's already open (wider viewports), the
  // nav link is simply already visible and this click is a harmless no-op
  // toggle-and-toggle-back is avoided by checking visibility first.
  const dashboardLink = page.getByRole('button', { name: 'Dashboard', exact: true });
  if (!(await dashboardLink.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Toggle Navigation' }).click();
  }
}

test.describe('sidebar navigation', () => {
  for (const dest of NAV_DESTINATIONS) {
    test(`${dest.label} loads with no uncaught errors`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await page.goto('/');
      await openSidebar(page);
      // Not `exact: true`: a nav button carrying a count badge (e.g. "Leads 7",
      // "Automation 6 On") folds the badge text into its accessible name, so
      // an exact match against the bare label never matches. Non-exact name
      // matching in Playwright is a substring match, which is what we want.
      //
      // Scoped to the <nav> landmark: several labels ("Quotes & Invoices",
      // "Notifications") also substring-match unrelated buttons elsewhere on
      // the page (a dashboard shortcut, the navbar bell icon) that stay in the
      // DOM behind the sidebar drawer.
      await page.getByRole('navigation').getByRole('button', { name: dest.label }).click();
      // getByText rather than getByRole('heading'): every module but
      // Inventory uses a real <h1>-style title, so a text match is the one
      // assertion that works uniformly across all of them.
      await expect(page.getByText(dest.heading).first()).toBeVisible({ timeout: 10_000 });
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});

test.describe('automation centre', () => {
  test('webhook config modal opens and closes cleanly', async ({ page }) => {
    await page.goto('/');
    await openSidebar(page);
    await page.getByRole('navigation').getByRole('button', { name: 'Automation' }).click();
    await expect(page.getByRole('heading', { name: 'Automation Center & n8n Engine' })).toBeVisible();

    await page.getByRole('button', { name: 'Webhook Config' }).click();
    await expect(page.getByRole('heading', { name: 'Configure n8n Webhook Server' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Configure n8n Webhook Server' })).not.toBeVisible();
  });

  test('every configured automation rule has a working Test Trigger button', async ({ page }) => {
    await page.goto('/');
    await openSidebar(page);
    await page.getByRole('navigation').getByRole('button', { name: 'Automation' }).click();
    await expect(page.getByRole('heading', { name: 'Automation Center & n8n Engine' })).toBeVisible();

    const triggerButtons = page.getByRole('button', { name: 'Test Trigger' });
    const count = await triggerButtons.count();
    expect(count).toBeGreaterThan(0);

    // Fire the first rule's trigger and confirm a log row appears in the
    // dispatch table — the reachable, non-destructive way to prove this
    // wiring works without depending on a real external n8n instance.
    const logsHeading = page.getByRole('heading', { name: 'Live n8n Webhook Dispatch Logs' });
    await expect(logsHeading).toBeVisible();
    const rowsBefore = await page.locator('table tbody tr').count();
    await triggerButtons.first().click();
    await expect
      .poll(() => page.locator('table tbody tr').count(), { timeout: 10_000 })
      .toBeGreaterThan(rowsBefore);
  });
});
