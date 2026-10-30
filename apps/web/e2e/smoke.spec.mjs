/**
 * Gatekeeper end-to-end smoke test (plain node + Playwright, no test runner).
 *
 * Playwright is NOT a dependency of apps/web; install it anywhere, e.g.:
 *   mkdir -p "$TEMP/gk-qa" && cd "$TEMP/gk-qa" && npm init -y && npm i -D playwright && npx playwright install chromium
 * Then, with the seeded API (and web) running:
 *   PW_HOME="$TEMP/gk-qa" node apps/web/e2e/smoke.spec.mjs [webUrl] [apiUrl]
 * Defaults: web http://localhost:5173, api http://localhost:4000/api/v1.
 * Env: SHOTS=<dir> screenshots (default ./e2e-shots) · ONLY=crawl|flows · PW_CHANNEL=msedge to use system Edge.
 * Exits 1 if any route or flow step hits an unexpected console error, page error, failed request or API status >= 400.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(process.env.PW_HOME ? path.join(process.env.PW_HOME, 'noop.js') : import.meta.url);
const { chromium } = require('playwright');

const WEB = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const API = (process.argv[3] || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || 'e2e-shots';
const ONLY = process.env.ONLY;
mkdirSync(SHOTS, { recursive: true });

const PHONES = { ADMIN: '9000000001', RESIDENT: '9000000002', RESIDENT_B: '9000000004', GUARD: '9000000003' };
const ROUTES = {
  marketing: ['/', '/features', '/pricing', '/about', '/contact', '/privacy', '/terms', '/login', '/nope-404'],
  ADMIN: ['/app/admin', '/app/admin/visitors', '/app/admin/residents', '/app/admin/staff', '/app/admin/notices', '/app/admin/polls',
    '/app/admin/helpdesk', '/app/admin/amenities', '/app/admin/billing', '/app/admin/expenses', '/app/admin/sos', '/app/admin/settings'],
  RESIDENT: ['/app/home', '/app/home/visitors', '/app/home/community', '/app/home/services', '/app/home/payments', '/app/home/profile'],
  GUARD: ['/app/gate', '/app/gate/log', '/app/gate/pending', '/app/gate/expected', '/app/gate/inside', '/app/gate/staff', '/app/gate/sos'],
};

const problems = [];
const report = (where, msg) => { problems.push(`${where}: ${msg}`); console.log(`  x ${where}: ${msg}`); };

// 4xx we provoke on purpose: wrong passcode, and NAME_REQUIRED during a brand-new sign-up.
const EXPECTED = [/^POST \/gate\/verify 404$/, /^POST \/auth\/otp\/verify 422$/];

/** Record unexpected errors on a page under a mutable label. */
function watch(page, label) {
  const w = { label };
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) report(w.label, `console: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => report(w.label, `pageerror: ${e.message}`));
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() < 400 || !u.startsWith(API)) return;
    const sig = `${r.request().method()} ${u.slice(API.length).split('?')[0]} ${r.status()}`;
    if (!EXPECTED.some((re) => re.test(sig))) report(w.label, `network: ${sig}`);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.includes('/events?') || !u.startsWith(API)) return; // SSE is aborted on navigation by design
    if (/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) return; // navigation cancelled an in-flight fetch
    report(w.label, `requestfailed: ${r.method()} ${u} ${r.failure()?.errorText}`);
  });
  return w;
}

/** Log in through the real UI: phone, read the dev-code banner, type the OTP (auto-submits). */
async function login(page, phone) {
  await page.goto(`${WEB}/login`);
  await page.getByPlaceholder('98765 43210').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  const banner = page.getByText(/Dev code:/);
  await banner.waitFor();
  const code = (await banner.textContent()).replace(/\D/g, '');
  await page.getByLabel('6-digit verification code').fill(code);
  await page.waitForURL(/\/app\/(admin|home|gate|societies|welcome)/);
}

/**
 * One real UI login per role per run (OTP requests are rate-limited to 5 / 15 min per phone),
 * then every other context reuses the saved localStorage session.
 */
const states = {};
async function signIn(browser, role) {
  if (states[role]) return states[role];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, `${role} login`);
  await login(page, PHONES[role]);
  const state = await ctx.storageState();
  await ctx.close();
  const sess = JSON.parse(state.origins[0].localStorage.find((x) => x.name === 'gk-session').value);
  return (states[role] = { state, token: sess.token, societyId: sess.memberships[0].society.id });
}

/** Direct API call as a signed-in role (setup only; assertions go through the UI). */
async function apiAs(browser, role, method, p, body) {
  const s = await signIn(browser, role);
  const r = await fetch(API + p, {
    method, body: body && JSON.stringify(body),
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${s.token}`, 'X-Society-Id': s.societyId },
  });
  return r.status === 204 ? null : r.json();
}

/** Leftover active SOS alerts take over the guard/admin screens; clear them so the crawl can see the pages. */
async function resolveActiveSos(browser) {
  const { items } = await apiAs(browser, 'GUARD', 'GET', '/sos');
  for (const a of items.filter((x) => x.status !== 'RESOLVED')) await apiAs(browser, 'GUARD', 'PATCH', `/sos/${a.id}`, { status: 'RESOLVED' });
}

/** New browser context already signed in as `role`. */
async function open(browser, role, label, { viewport = { width: 1440, height: 900 }, colorScheme = 'light' } = {}) {
  const { state } = await signIn(browser, role);
  const ctx = await browser.newContext({ viewport, colorScheme, storageState: state });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15_000);
  const w = watch(page, label);
  return { ctx, page, w };
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(250);
}

const BAD_TEXT = /Something went wrong|Couldn.t load|undefined|NaN|\[object Object\]|Invalid Date/;
async function checkPage(page, label) {
  const txt = (await page.locator('body').innerText()).trim();
  if (txt.length < 20) report(label, 'blank screen');
  const m = txt.match(new RegExp(`.{0,40}(${BAD_TEXT.source}).{0,40}`));
  if (m) report(label, `suspicious text: "${m[0].replace(/\s+/g, ' ')}"`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) report(label, `horizontal overflow ${overflow}px`);
}

const slug = (s) => s.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_') || 'home';
const DESK = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function crawl(browser) {
  console.log('> crawl');
  for (const [vp, n] of [[DESK, 'desktop'], [MOBILE, 'mobile']]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const w = watch(page, '');
    for (const r of ROUTES.marketing) {
      w.label = `marketing ${r} ${n}`;
      await page.goto(WEB + r); await settle(page);
      await checkPage(page, w.label);
      if (r === '/') await page.waitForTimeout(1500); // hero ledger animates in
      await page.screenshot({ path: `${SHOTS}/marketing_${slug(r)}_${n}.png`, fullPage: r === '/' });
    }
    await ctx.close();
  }
  for (const role of ['ADMIN', 'RESIDENT', 'GUARD']) {
    const runs = [[DESK, 'desktop', 'light'], [DESK, 'desktop', 'dark']];
    if (role !== 'ADMIN') runs.push([MOBILE, 'mobile', 'light']);
    for (const [vp, n, scheme] of runs) {
      const { ctx, page, w } = await open(browser, role, role, { viewport: vp, colorScheme: scheme });
      for (const r of ROUTES[role]) {
        w.label = `${role} ${r} ${n} ${scheme}`;
        await page.goto(WEB + r); await settle(page);
        await checkPage(page, w.label);
        await page.screenshot({ path: `${SHOTS}/${role.toLowerCase()}_${slug(r)}_${n}_${scheme}.png` });
        // Every in-page tab fetches its own data; visit them too (light desktop pass only).
        if (n !== 'desktop' || scheme !== 'light') continue;
        const tabs = await page.locator('main [role="tab"]').allTextContents();
        for (const [i, t] of tabs.entries()) {
          if (i === 0) continue;
          w.label = `${role} ${r} tab "${t}"`;
          await page.locator('main [role="tab"]').nth(i).click(); await settle(page);
          await checkPage(page, w.label);
        }
      }
      const detail = role === 'ADMIN' ? ['/app/admin/helpdesk', 'a[href*="/app/admin/helpdesk/"]'] : role === 'RESIDENT' ? ['/app/home/services', 'a[href*="/services/tickets/"]'] : null;
      if (detail) {
        await page.goto(WEB + detail[0]); await settle(page);
        const link = page.locator(detail[1]).first();
        if (await link.count()) {
          w.label = `${role} ticket detail ${n} ${scheme}`;
          await link.click(); await settle(page); await checkPage(page, w.label);
          await page.screenshot({ path: `${SHOTS}/${role.toLowerCase()}_ticket_${n}_${scheme}.png` });
        } else report(`${role} ticket detail`, 'no ticket link found');
      }
      await ctx.close();
    }
  }
}

/* ── Flows ─────────────────────────────────────────────────────────── */
async function step(w, name, fn) {
  const prev = w.label; w.label = `flow ${name}`;
  try { await fn(); console.log(`  ok ${name}`); }
  catch (e) { report(`flow ${name}`, e.message.split('\n')[0]); }
  finally { w.label = prev; }
}

async function flows(browser) {
  console.log('> flows');
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  const toast = (page, re) => page.locator('[role="status"]').getByText(re).first().waitFor({ timeout: 10_000 });
  const G = await open(browser, 'GUARD', 'guard');
  const R = await open(browser, 'RESIDENT', 'resident', { viewport: MOBILE });
  const A = await open(browser, 'ADMIN', 'admin');
  const g = G.page, r = R.page, a = A.page;
  await r.goto(`${WEB}/app/home`); await settle(r);

  async function logVisitor(type, fill) {
    await g.goto(`${WEB}/app/gate/log`); await settle(g);
    await g.getByRole('button', { name: type, exact: true }).click();
    await g.getByRole('tab', { name: 'Block A' }).click();
    await g.getByRole('button', { name: /^101/ }).click();
    await fill();
    await g.getByRole('button', { name: 'Send for approval' }).click();
    await g.getByText(/Waiting for A-101 to respond/).waitFor();
  }
  const closeDialog = (p) => p.getByRole('dialog').getByRole('button', { name: 'Close' }).click({ timeout: 3000 }).catch(() => {});

  // 1. Walk-in guest: guard logs, resident sees the live approval card (SSE), approves, guard sees APPROVED, check in, out.
  await step(G.w, 'walk-in guest approval (realtime)', async () => {
    const name = `QA Guest ${ts}`;
    await logVisitor('Guest', () => g.getByLabel('Name').fill(name));
    const card = r.getByRole('dialog').getByRole('article', { name: new RegExp(name) });
    await card.waitFor({ timeout: 10_000 });
    await r.waitForTimeout(600); // modal rise animation
    await r.screenshot({ path: `${SHOTS}/resident_approval_card_mobile.png` });
    await card.getByRole('button', { name: 'Approve entry' }).click();
    await card.getByText(/Entry approved/).waitFor();
    await g.getByText(/Approved by Rohan/).waitFor({ timeout: 10_000 });
    await g.getByRole('button', { name: 'Check in' }).click();
    await g.getByText(new RegExp(`${name} checked in at`)).waitFor();
    await g.goto(`${WEB}/app/gate/inside`); await settle(g);
    await g.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Check out' }).click();
    await toast(g, `${name} checked out.`);
    await closeDialog(r);
  });

  // 2. Delivery: resident chooses "Leave at gate", guard marks the parcel collected.
  await step(G.w, 'delivery left at gate -> collected', async () => {
    const co = `QA Parcel ${ts}`;
    await logVisitor('Delivery', async () => {
      await g.getByRole('button', { name: 'Other' }).click();
      await g.getByLabel('Company name').fill(co);
    });
    const card = r.getByRole('dialog').getByRole('article', { name: new RegExp(co) });
    await card.waitFor({ timeout: 10_000 });
    await card.getByRole('button', { name: 'Leave at gate' }).click();
    await g.getByText(/Keep the parcel at the gate/).waitFor({ timeout: 10_000 });
    await g.goto(`${WEB}/app/gate/inside`); await settle(g);
    await g.getByRole('listitem').filter({ hasText: co }).getByRole('button', { name: 'Collected' }).click();
    await toast(g, 'Parcel marked as collected.');
    await closeDialog(r);
  });

  // 3. Gate passcodes (typed on the hardware keyboard; the keypad auto-verifies on the 6th digit).
  async function keypad(code) {
    await g.goto(`${WEB}/app/gate`); await settle(g);
    await g.keyboard.type(code);
    const alert = g.getByRole('alert');
    await alert.waitFor({ timeout: 10_000 });
    return (await alert.innerText()).replace(/\s+/g, ' ');
  }
  await step(G.w, 'passcode 135790 -> visitor checked in', async () => {
    const t = await keypad('135790');
    if (!/Passcode accepted/.test(t)) throw new Error(t);
  });
  await step(G.w, 'passcode 482913 -> staff in/out toggle', async () => {
    const t1 = await keypad('482913');
    const t2 = await keypad('482913');
    const kinds = [t1, t2].map((t) => (t.match(/Staff checked (in|out)/) ?? [])[1]).sort().join(',');
    if (kinds !== 'in,out') throw new Error(`${t1} | ${t2}`);
  });
  await step(G.w, 'passcode 000000 -> friendly error', async () => {
    const t = await keypad('000000');
    if (!/Passcode not recognised/.test(t)) throw new Error(t);
    await g.screenshot({ path: `${SHOTS}/guard_passcode_error.png` });
  });

  // 4. Admin flows.
  await step(A.w, 'admin dashboard KPIs', async () => {
    await a.goto(`${WEB}/app/admin`); await settle(a);
    for (const k of ['Outstanding dues', 'Expenses this month', 'Visitors today', 'Open requests']) await a.getByText(k).first().waitFor();
    const txt = await a.locator('main').innerText();
    if (!/\d+%/.test(txt) || !/₹[\d,]+/.test(txt)) throw new Error('KPI values missing');
  });
  const noticeTitle = `QA notice ${ts}`;
  await step(A.w, 'admin posts notice -> resident sees it live', async () => {
    await r.goto(`${WEB}/app/home/community`); await settle(r);
    await a.goto(`${WEB}/app/admin/notices?compose=1`); await settle(a);
    const d = a.getByRole('dialog');
    await d.getByLabel('Title').fill(noticeTitle);
    await d.getByLabel(/^Notice/).fill('Smoke-test notice body.');
    await d.getByRole('button', { name: 'Post notice' }).click();
    await toast(a, 'Notice posted to all members.');
    await r.getByText(noticeTitle).first().waitFor({ timeout: 10_000 });
  });
  await step(A.w, 'admin creates poll', async () => {
    await a.goto(`${WEB}/app/admin/polls`); await settle(a);
    await a.getByRole('button', { name: 'Create poll' }).first().click();
    const d = a.getByRole('dialog');
    await d.getByLabel('Question').fill(`QA poll ${ts}?`);
    await d.getByLabel('Option 1').fill('Yes');
    await d.getByLabel('Option 2').fill('No');
    await d.getByRole('button', { name: 'Create poll' }).click();
    await toast(a, /Poll created/);
    await a.getByText(`QA poll ${ts}?`).waitFor();
  });
  await step(A.w, 'admin generates next-month invoices (idempotent)', async () => {
    const d0 = new Date(); const next = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1));
    const period = next.toISOString().slice(0, 7);
    for (const expect of [/invoices created|already exist/, /already exist/]) {
      await a.goto(`${WEB}/app/admin/billing`); await settle(a);
      await a.getByRole('button', { name: 'Generate invoices' }).first().click();
      const d = a.getByRole('dialog');
      await d.getByLabel('Billing month').fill(period);
      await d.getByLabel(/Amount per flat/).fill('3500');
      await d.getByRole('button', { name: 'Generate invoices' }).click();
      await toast(a, expect);
    }
  });
  await step(A.w, 'admin adds expense', async () => {
    await a.goto(`${WEB}/app/admin/expenses`); await settle(a);
    await a.getByRole('button', { name: 'Add expense' }).first().click();
    const d = a.getByRole('dialog');
    await d.getByLabel(/^Amount/).fill('1234.50');
    await d.getByLabel(/^Vendor/).fill(`QA Vendor ${ts}`);
    await d.getByRole('button', { name: 'Add expense' }).click();
    await toast(a, /Expense of ₹1,234\.50 recorded/);
    await a.getByText(`QA Vendor ${ts}`).waitFor();
  });
  await step(A.w, 'admin adds block + bulk flats + member', async () => {
    const block = `Q${ts}`;
    await a.goto(`${WEB}/app/admin/residents`); await settle(a);
    await a.getByRole('button', { name: 'Add block' }).first().click();
    await a.getByRole('dialog').getByLabel(/Block or tower name/).fill(block);
    await a.getByRole('dialog').getByRole('button', { name: 'Add block' }).click();
    await toast(a, `Block ${block} added.`);
    await a.getByRole('button', { name: 'Add flats' }).first().click();
    const d = a.getByRole('dialog');
    await d.getByLabel('Block').selectOption({ label: `Block ${block}` });
    await d.getByLabel('Flat numbers').fill('1-3');
    await d.getByRole('button', { name: /^Add 3 flats/ }).click();
    await toast(a, '3 flats added.');
    await a.getByText(`${block}-2`).waitFor();
    await a.getByRole('tab', { name: 'Members' }).click();
    await a.getByRole('button', { name: 'Add member' }).first().click();
    const m = a.getByRole('dialog');
    await m.getByLabel('Mobile number').fill(`97${String(Date.now()).slice(-8)}`);
    await m.getByLabel('Name').fill(`QA Member ${ts}`);
    await m.getByLabel('Flat').selectOption({ label: `${block}-1` });
    await m.getByRole('button', { name: 'Add member' }).click();
    await toast(a, `QA Member ${ts} added as resident.`);
    await a.getByRole('row').filter({ hasText: `QA Member ${ts}` }).waitFor();
  });
  await step(A.w, 'admin creates amenity', async () => {
    await a.goto(`${WEB}/app/admin/amenities`); await settle(a);
    await a.getByRole('button', { name: 'Add amenity' }).first().click();
    const d = a.getByRole('dialog');
    await d.getByLabel('Name').fill(`QA Court ${ts}`);
    await d.getByLabel('Opens at').fill('07:00');
    await d.getByLabel('Closes at').fill('21:00');
    await d.getByLabel(/Price per slot/).fill('250');
    await d.getByLabel('Availability').selectOption('0'); // closed, so residents' lists stay clean
    await d.getByRole('button', { name: 'Add amenity' }).click();
    await toast(a, `QA Court ${ts} added.`);
    await a.getByRole('heading', { name: `QA Court ${ts}` }).waitFor();
  });
  await step(A.w, 'admin links staff to a flat', async () => {
    await a.goto(`${WEB}/app/admin/staff`); await settle(a);
    await a.getByRole('row').filter({ hasText: 'Lakshmi' }).getByRole('button', { name: 'Link flat' }).click();
    const d = a.getByRole('dialog');
    const opts = await d.getByLabel('Flat').locator('option').allTextContents();
    if (opts.length < 2) { console.log('    (Lakshmi already linked to every flat; skipped)'); await d.getByRole('button', { name: 'Cancel' }).click(); return; }
    await d.getByLabel('Flat').selectOption({ index: 1 });
    await d.getByRole('button', { name: 'Link flat' }).click();
    await toast(a, 'Lakshmi Devi linked.');
    await a.getByRole('row').filter({ hasText: 'Lakshmi' }).getByText(opts[1]).waitFor();
  });

  // 5. Resident flows.
  await step(R.w, 'resident creates invite -> passcode -> guard verifies it', async () => {
    await r.goto(`${WEB}/app/home/visitors?invite=1`); await settle(r);
    const d = r.getByRole('dialog');
    await d.getByLabel('Guest name').fill(`QA Invitee ${ts}`);
    await d.getByRole('button', { name: 'Create invite' }).click();
    const code = d.getByLabel(/^Passcode \d/);
    await code.waitFor();
    const passcode = (await code.getAttribute('aria-label')).replace(/\D/g, '');
    if (passcode.length !== 6) throw new Error(`bad passcode ${passcode}`);
    await r.screenshot({ path: `${SHOTS}/resident_invite_mobile.png` });
    await closeDialog(r);
    const t = await keypad(passcode);
    if (!/Passcode accepted/.test(t) || !t.includes(`QA Invitee ${ts}`)) throw new Error(t);
  });
  const ticketTitle = `QA leak ${ts}`;
  await step(R.w, 'resident raises ticket -> admin updates + comments -> resident sees it', async () => {
    await r.goto(`${WEB}/app/home/services?tab=helpdesk&new=1`); await settle(r);
    const d = r.getByRole('dialog');
    await d.getByText('Plumbing').click();
    await d.getByLabel('Title').fill(ticketTitle);
    await d.getByLabel('Description').fill('Smoke-test: bathroom tap dripping.');
    await d.getByRole('button', { name: 'Raise request' }).click();
    await toast(r, /Request raised/);
    await a.goto(`${WEB}/app/admin/helpdesk`); await settle(a);
    await a.getByRole('link', { name: ticketTitle }).click();
    await a.getByRole('button', { name: 'Start work' }).click();
    await toast(a, 'Request updated.');
    await a.getByLabel('Assigned to').selectOption({ index: 1 });
    await a.getByLabel('Add a comment').fill('Plumber is on the way.');
    await a.getByRole('button', { name: 'Send' }).click();
    await toast(a, 'Comment added.');
    await a.getByText('Plumber is on the way.').waitFor();
    await r.goto(`${WEB}/app/home/services?tab=helpdesk`); await settle(r);
    await r.getByRole('link', { name: new RegExp(ticketTitle) }).click(); await settle(r);
    await r.getByText('Plumber is on the way.').waitFor();
    await r.getByText(/In progress/i).first().waitFor();
  });
  await step(R.w, 'resident books an amenity slot (then cancels)', async () => {
    await r.goto(`${WEB}/app/home/services?tab=amenities`); await settle(r);
    const card = r.locator('section').filter({ has: r.getByRole('heading', { name: 'Tennis Court' }) });
    await card.getByRole('button', { name: 'Book' }).click();
    await card.getByRole('radiogroup', { name: 'Date' }).getByRole('radio').nth(2).click();
    await card.getByRole('radiogroup', { name: 'Time slot' }).locator('button:not([disabled])').first().click();
    await r.getByRole('button', { name: 'Book slot' }).click();
    await toast(r, /Booked Tennis Court/);
    const mine = r.locator('section').filter({ has: r.getByRole('heading', { name: 'My bookings' }) });
    await mine.getByText('Tennis Court').first().waitFor();
    await mine.getByRole('button', { name: 'Cancel' }).first().click();
    await r.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click();
    await toast(r, 'Booking cancelled.');
  });
  await step(R.w, 'resident pays an invoice (mock)', async () => {
    await r.goto(`${WEB}/app/home/payments`); await settle(r);
    const pay = r.getByRole('main').getByRole('button', { name: /^Pay ₹/ }).first();
    if (!(await pay.count())) return console.log('    (A-101 has no unpaid invoice left; skipped)');
    await pay.click();
    const d = r.getByRole('dialog');
    await d.getByText('Card').click();
    await d.getByRole('button', { name: /^Pay ₹/ }).click();
    await d.getByText('Payment received').first().waitFor({ timeout: 10_000 });
    await d.getByText(/Reference MOCK-CARD-/).waitFor();
    await d.getByRole('button', { name: 'Done' }).click();
  });
  await step(R.w, 'resident votes in poll', async () => {
    await r.goto(`${WEB}/app/home/community`); await settle(r);
    await r.getByRole('tab', { name: 'Polls' }).click(); await settle(r);
    const card = r.locator('section').filter({ hasText: `QA poll ${ts}?` });
    await card.getByText('Yes', { exact: true }).click();
    await card.getByRole('button', { name: 'Submit vote' }).click();
    await toast(r, 'Vote recorded.');
    await card.getByText('Your vote').waitFor();
  });

  // 6. SOS: resident long-presses, guard takeover, acknowledge, resident sees it, guard resolves.
  await step(R.w, 'SOS long-press -> guard takeover -> ack -> resolve', async () => {
    await g.goto(`${WEB}/app/gate`); await settle(g);
    await r.goto(`${WEB}/app/home`); await settle(r);
    await r.getByRole('button', { name: /^SOS/ }).hover();
    await r.mouse.down(); await r.waitForTimeout(2300); await r.mouse.up();
    const d = r.getByRole('dialog');
    await d.getByRole('radio', { name: 'Medical' }).click();
    await d.getByLabel(/^Message/).fill(`QA SOS ${ts}`);
    await d.getByRole('button', { name: 'Send alert' }).click();
    await d.getByText(/Alert sent at/).waitFor();
    const take = g.getByRole('alertdialog');
    await take.getByText(`QA SOS ${ts}`).waitFor({ timeout: 10_000 });
    await g.screenshot({ path: `${SHOTS}/guard_sos_takeover.png` });
    await take.getByRole('button', { name: /Acknowledge/ }).click();
    await d.getByText(/is on the way/).waitFor({ timeout: 10_000 });
    await g.goto(`${WEB}/app/gate/sos`); await settle(g);
    await g.locator('article').filter({ hasText: `QA SOS ${ts}` }).getByRole('button', { name: 'Mark resolved' }).click();
    await toast(g, 'Alert marked resolved.');
    await d.locator('li').filter({ hasText: 'Resolved' }).getByText(/\d:\d\d/).waitFor({ timeout: 10_000 });
    await d.getByRole('button', { name: 'Close' }).click();
  });

  // 7. Smaller round-trips: deny, cancel invite, close ticket, record cash, profile, notifications.
  await step(R.w, 'resident denies a walk-in', async () => {
    const name = `QA Deny ${ts}`;
    await logVisitor('Cab', async () => { await g.getByRole('button', { name: 'Uber' }).click(); await g.getByLabel(/^Name/).fill(name); });
    const card = r.getByRole('dialog').getByRole('article', { name: new RegExp(name) });
    await card.waitFor({ timeout: 10_000 });
    await card.getByRole('button', { name: 'Deny' }).click();
    await r.getByRole('dialog', { name: `Deny entry to ${name}?` }).getByRole('button', { name: 'Deny entry' }).click();
    await g.getByText(/Denied by A-101/).waitFor({ timeout: 10_000 });
    await closeDialog(r);
  });
  await step(R.w, 'resident cancels an invite', async () => {
    await r.goto(`${WEB}/app/home/visitors?tab=invites`); await settle(r);
    const item = r.getByRole('listitem').filter({ hasText: `QA Invitee ${ts}` }).first();
    if (!(await item.getByRole('button', { name: 'Show pass' }).count())) return; // single-use invite already USED above
    await item.getByRole('button', { name: 'Show pass' }).click();
    await item.getByRole('button', { name: 'Cancel invite' }).click();
    await r.getByRole('dialog').getByRole('button', { name: 'Cancel invite' }).click();
    await toast(r, /Invite cancelled/);
  });
  await step(R.w, 'resident closes own ticket', async () => {
    await r.goto(`${WEB}/app/home/services?tab=helpdesk`); await settle(r);
    await r.getByRole('link', { name: new RegExp(ticketTitle) }).click(); await settle(r);
    await r.getByRole('button', { name: 'Close request' }).click();
    await toast(r, 'Request updated.');
    await r.getByText('This request is closed.').waitFor();
  });
  await step(A.w, 'admin records a cash payment', async () => {
    await a.goto(`${WEB}/app/admin/billing`); await settle(a);
    const btn = a.getByRole('button', { name: 'Record cash' }).first();
    if (!(await btn.count())) return console.log('    (no unpaid invoice this month; skipped)');
    await btn.click();
    await a.getByRole('dialog').getByRole('button', { name: 'Record payment' }).click();
    await toast(a, /Cash payment recorded/);
  });
  await step(R.w, 'resident edits profile', async () => {
    await r.goto(`${WEB}/app/home/profile`); await settle(r);
    await r.getByLabel(/^Email/).fill(`rohan.${ts.toLowerCase()}@example.com`);
    await r.getByRole('button', { name: 'Save changes' }).click();
    await toast(r, 'Changes saved.');
  });
  await step(R.w, 'notifications panel: mark all read', async () => {
    await r.getByRole('button', { name: 'Open notifications' }).click();
    const d = r.getByRole('dialog', { name: 'Notifications' });
    await d.getByRole('listitem').first().waitFor();
    const all = d.getByRole('button', { name: 'Mark all as read' });
    if (await all.count()) { await all.click(); await toast(r, 'All notifications marked as read.'); }
    await closeDialog(r);
  });

  await step(A.w, 'admin: attendance, edit amenity, pin notice', async () => {
    await a.goto(`${WEB}/app/admin/staff`); await settle(a);
    await a.getByRole('row').filter({ hasText: 'Lakshmi' }).getByRole('button', { name: 'Attendance' }).click();
    await a.getByRole('dialog', { name: /Lakshmi Devi · attendance/ }).getByText(/In \d/).first().waitFor();
    await closeDialog(a);
    await a.goto(`${WEB}/app/admin/amenities`); await settle(a);
    await a.getByRole('button', { name: 'Edit Clubhouse' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await toast(a, 'Clubhouse updated.');
    await a.goto(`${WEB}/app/admin/notices`); await settle(a);
    await a.getByRole('button', { name: `Pin ${noticeTitle}` }).click();
    await toast(a, 'Notice pinned.');
    await a.getByRole('button', { name: `Unpin ${noticeTitle}` }).waitFor();
  });
  await step(R.w, 'resident: daily help attendance + add modal', async () => {
    await r.goto(`${WEB}/app/home/services?tab=help`); await settle(r);
    await r.getByRole('main').getByRole('button', { name: /Lakshmi Devi/ }).click();
    await r.getByRole('dialog', { name: /Lakshmi Devi · attendance/ }).getByText(/In \d/).first().waitFor();
    await closeDialog(r);
    await r.getByRole('button', { name: 'Add daily help' }).first().click();
    await r.getByRole('dialog', { name: /Add daily help/ }).getByText(/Ramesh|Everyone registered/).first().waitFor();
    await closeDialog(r);
  });

  await step(A.w, 'admin deletes the QA notice', async () => {
    await a.goto(`${WEB}/app/admin/notices`); await settle(a);
    await a.getByRole('button', { name: `Delete ${noticeTitle}` }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Delete notice' }).click();
    await toast(a, 'Notice deleted.');
  });

  for (const s of [G, R, A]) await s.ctx.close();

  // 8. Brand-new user: OTP with NAME_REQUIRED, create a society + blocks, add Priya (B-201) to it,
  //    then Priya picks a society and switches between them; finally she is removed again.
  const N = await browser.newContext({ viewport: DESK });
  const n = await N.newPage(); n.setDefaultTimeout(15_000);
  const nw = watch(n, 'new user');
  const society = `QA Society ${ts}`;
  await step(nw, 'new user signs up and creates a society', async () => {
    const phone = `96${String(Date.now()).slice(-8)}`;
    await n.goto(`${WEB}/login`);
    await n.getByPlaceholder('98765 43210').fill(phone);
    await n.getByRole('button', { name: 'Send code' }).click();
    const banner = n.getByText(/Dev code:/); await banner.waitFor();
    await n.getByLabel('6-digit verification code').fill((await banner.textContent()).replace(/\D/g, ''));
    await n.getByLabel('What should we call you?').fill(`QA Founder ${ts}`);
    await n.getByRole('button', { name: 'Create account' }).click();
    await n.waitForURL(/\/app\/welcome/);
    await n.getByLabel('Society name').fill(society);
    await n.getByLabel('Address line').fill('1 Test Street');
    await n.getByLabel('City').fill('Pune');
    await n.getByLabel('State').selectOption('Maharashtra');
    await n.getByLabel('Pincode').fill('411001');
    await n.getByRole('button', { name: 'Create society' }).click();
    await n.getByRole('heading', { name: 'Add blocks and flats' }).waitFor();
    await n.getByLabel('Blocks or towers').fill('T1');
    await n.getByLabel('Flat numbers in each block').fill('1-2');
    await n.getByRole('button', { name: 'Add blocks and flats' }).click();
    await n.waitForURL(/\/app\/admin$/); await settle(n);
    await n.getByText(society).first().waitFor();
    await n.goto(`${WEB}/app/admin/residents`); await settle(n);
    await n.getByText('T1-2').waitFor();
    await n.getByRole('tab', { name: 'Members' }).click();
    await n.getByRole('button', { name: 'Add member' }).first().click();
    const m = n.getByRole('dialog');
    await m.getByLabel('Mobile number').fill(PHONES.RESIDENT_B);
    await m.getByLabel('Name').fill('Priya Iyer');
    await m.getByLabel('Flat').selectOption({ label: 'T1-1' });
    await m.getByRole('button', { name: 'Add member' }).click();
    await toast(n, /Priya Iyer added as resident/);
  });
  await step(nw, 'multi-society resident picks and switches society', async () => {
    const { ctx, page: p, w } = await open(browser, 'RESIDENT_B', 'priya');
    w.label = 'flow society switch';
    await p.goto(`${WEB}/app`); await p.waitForURL(/\/app\/societies/);
    await p.getByRole('button', { name: /Emerald Heights/ }).click();
    await p.waitForURL(/\/app\/home$/); await settle(p);
    await p.getByText('B-201, Emerald Heights').waitFor();
    await p.getByRole('button', { name: /Emerald Heights/ }).first().click();
    await p.getByRole('dialog', { name: 'Switch society' }).getByRole('button', { name: new RegExp(society) }).click();
    await p.getByText(`T1-1, ${society}`).waitFor(); await settle(p);
    for (const route of ROUTES.RESIDENT) { await p.goto(WEB + route); await settle(p); await checkPage(p, `priya ${route} in ${society}`); }
    await ctx.close();
  });
  await step(nw, 'new admin removes Priya again', async () => {
    await n.goto(`${WEB}/app/admin/residents`); await settle(n);
    await n.getByRole('tab', { name: 'Members' }).click();
    await n.getByRole('row').filter({ hasText: 'Priya' }).getByRole('button', { name: 'Deactivate' }).click();
    await n.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await toast(n, /Priya Iyer is now inactive/);
  });
  await N.close();
}

async function main() {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  try {
    await resolveActiveSos(browser);
    if (ONLY !== 'flows') await crawl(browser);
    if (ONLY !== 'crawl') await flows(browser);
  } finally { await browser.close(); }
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll clean.');
  process.exit(problems.length ? 1 : 0);
}

main();
