import { test, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';


/**
 * ASM09 - HUNT10: 10 independent defect hypotheses.
 * Each test observes the REAL website and records evidence.
 * CANDIDATE is not a confirmed production defect.
 *
 * Run with:
 * npx playwright test "tests/23130067_PhamMinhDuc/23130067_PhamMinhDuc_HUNT10.spec.ts" --headed --workers=1 --retries=0 --repeat-each=3 --reporter=line
 */
const BASE = 'https://didongviet.vn';
const CATALOG = BASE + '/dien-thoai.html';
const IPHONE = BASE + '/dien-thoai-iphone.html';
const RUN_ID = process.env.ASM09_RUN_ID ||
    new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.resolve(__dirname, '..', '..', '..',
    'Test Report - Group08', '23130067_PhamMinhDuc_ASM09',
    'HUNT10_REAL', 'runs', RUN_ID);
fs.mkdirSync(OUT, { recursive: true });


test.use({ trace: 'on', video: 'on', screenshot: 'on' });
test.setTimeout(120000);


type Item = { slug: string; name: string; price: number | null; url: string };
type Comparison = { productId?: string; slug?: string; name?: string; price?: number };
type Observation = Record<string, unknown>;
type Result = {
    id: string; title: string; tryNumber: number; status: string;
    startedAt: string; finishedAt?: string; pageUrl?: string;
    reason?: string; observations: Observation[]; playwrightOutput?: string;
    screenshot?: string;
};


class Candidate extends Error { constructor(message: string) { super(message); this.name = 'Candidate'; } }
class Inconclusive extends Error { constructor(message: string) { super(message); this.name = 'Inconclusive'; } }
const suspect = (message: string): never => { throw new Candidate(message); };
const inconclusive = (message: string): never => { throw new Inconclusive(message); };
const note = (r: Result, x: Observation) => r.observations.push(x);
const short = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 300);


function getId(number: number): string {
    return 'DDV-DUC-' + String(number).padStart(2, '0');
}


function summary(): void {
    const lines: string[] = [];
    const statuses: string[] = [];
    for (let k = 1; k <= 10; k++) {
        const id = getId(k);
        const matching = fs.readdirSync(OUT)
            .filter(f => f.startsWith(id + '_try') && f.endsWith('.json'));
        const results = matching.map(f => {
            try { return JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) as Result; }
            catch { return null; }
        }).filter((x): x is Result => x !== null);
        const signals = results.filter(x => x.status === 'DEFECT_CANDIDATE').length;
        const pass = results.filter(x => x.status === 'PASS').length;
        const incomplete = results.length - signals - pass;
        const repro = results.length
            ? 'Nghi vấn ' + signals + '/' + results.length + ' lượt; PASS ' +
            pass + '; chưa kết luận ' + incomplete
            : 'Chưa có kết quả';
        const proofs = results.map(x => {
            const label = 'lần ' + x.tryNumber + ' (' + x.status + ')';
            return label + ': ' + path.basename(x.screenshot || '') +
                ', ' + id + '_try' + x.tryNumber + '.json' + '; video/trace: ' + (x.playwrightOutput || '');
        }).join('; ');
        lines.push(repro + '\t' + (proofs || 'Chưa có file bằng chứng'));
        statuses.push(signals > 0
            ? 'Candidate - cần xác minh thủ công'
            : incomplete === results.length ? 'Inconclusive' : 'Not Reproduced');
    }
    fs.writeFileSync(path.join(OUT, 'EXCEL_COLUMNS_L_M.tsv'),
        '\uFEFF' + lines.join('\r\n'), 'utf8');
    fs.writeFileSync(path.join(OUT, 'EXCEL_COLUMN_O.tsv'),
        '\uFEFF' + statuses.join('\r\n'), 'utf8');
}


function register(n: number, title: string,
                  check: (page: Page, r: Result) => Promise<void>): void {
    const id = getId(n);
    test(id + ' - ' + title, async ({ page }, testInfo) => {
        const turn = testInfo.repeatEachIndex + 1;
        const r: Result = {
            id, title, tryNumber: turn, status: 'PASS',
            startedAt: new Date().toISOString(), observations: [],
            playwrightOutput: testInfo.outputDir
        };
        let thrown: unknown = null;
        try {
            await check(page, r);
        } catch (error) {
            thrown = error;
            r.reason = error instanceof Error ? error.message : String(error);
            r.status = error instanceof Candidate ? 'DEFECT_CANDIDATE'
                : error instanceof Inconclusive ? 'INCONCLUSIVE' : 'SCRIPT_OR_ENV_ERROR';
        } finally {
            r.pageUrl = page.url();
            r.finishedAt = new Date().toISOString();
            const stem = id + '_try' + turn;
            const screenshot = path.join(OUT, stem + '.png');
            try {
                await page.screenshot({ path: screenshot, timeout: 9000, fullPage: false });
                r.screenshot = screenshot;
            } catch { /* A screenshot failure does not discard JSON evidence. */ }
            fs.writeFileSync(path.join(OUT, stem + '.json'),
                JSON.stringify(r, null, 2), 'utf8');
            summary();
            console.log('[' + r.status + '] ' + id + ' try ' + turn +
                ': ' + (r.reason || title));
        }
        if (thrown instanceof Inconclusive) test.skip(true, thrown.message);
        if (thrown) throw thrown;
    });
}


async function open(page: Page, url: string): Promise<void> {
    let response;
    try {
        response = await page.goto(url, {
            waitUntil: 'domcontentloaded', timeout: 45000
        });
    } catch (e) { inconclusive('Navigation failed: ' + String(e)); }
    if (response && [403, 408, 429, 500, 502, 503, 504].includes(response.status()))
        inconclusive('Website HTTP ' + response.status());
    await page.waitForTimeout(1000);
}


async function dismissCookie(page: Page): Promise<void> {
    const dialog = page.locator('[role="dialog"][aria-label*="cookie" i]').first();
    if (!await dialog.isVisible().catch(() => false)) return;
    const buttons = dialog.getByRole('button', {
        name: /Từ chối|Chỉ cần thiết|Đồng ý tất cả|Chấp nhận/i
    });
    for (let i = 0; i < await buttons.count(); i++) {
        const b = buttons.nth(i);
        if (!await b.isVisible().catch(() => false)) continue;
        try { await b.click({ timeout: 4000 }); return; } catch { /* Next button. */ }
    }
    inconclusive('Cookie popup blocked normal interaction');
}


function searchUrl(keyword: string): string {
    const url = new URL('/search', BASE);
    url.searchParams.set('q', keyword);
    return url.toString();
}


async function search(page: Page, keyword: string): Promise<Item[]> {
    await open(page, searchUrl(keyword));
    // Một số trang tìm kiếm redirect sau DOMContentLoaded; tránh đọc giữa navigation.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await products(page);
        } catch (e) {
            if (!String(e).includes('Execution context was destroyed') || attempt === 2)
                throw e;
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            await page.waitForTimeout(800);
        }
    }
    return [];
}


// Only catalog/search cards that have a local product link,
// a nearby price, and their OWN Compare control are considered.
async function products(page: Page): Promise<Item[]> {
    return page.evaluate(() => {
        const found: Item[] = [];
        const seen = new Set<string>();
        const root = document.querySelector('main') || document.body;
        const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>(
            'a[href*="/dien-thoai/"]'));
        for (const a of anchors) {
            const pathname = new URL(a.href).pathname;
            if (!/^\/dien-thoai\/[^/]+\.html$/.test(pathname) || seen.has(pathname)) continue;
            let parent: HTMLElement | null = a;
            let card: HTMLElement | null = null;
            for (let depth = 0; depth < 11 && parent; depth++) {
                const other = new Set(Array.from(parent.querySelectorAll<HTMLAnchorElement>(
                    'a[href*="/dien-thoai/"]')).map(x => new URL(x.href).pathname)
                    .filter(x => /^\/dien-thoai\/[^/]+\.html$/.test(x)));
                if (other.size > 1) break;
                const hasCompare = Array.from(parent.querySelectorAll<HTMLElement>(
                    'button,[role="button"]')).some(b =>
                    /so sánh|danh sách so sánh/i.test(
                        b.getAttribute('aria-label') || b.innerText || ''));
                if (hasCompare && /\d{1,3}(?:[.,]\d{3})+\s*(?:đ|₫)/i.test(parent.innerText || '')) {
                    card = parent; break;
                }
                parent = parent.parentElement;
            }
            if (!card) continue;
            const text = (card.innerText || '').replace(/\s+/g, ' ');
            const priceRaw = text.match(/\d{1,3}(?:[.,]\d{3})+\s*(?:đ|₫)/i);
            const slug = pathname.split('/').pop()!.replace(/\.html$/, '');
            found.push({
                slug, name: card.querySelector<HTMLElement>('h2,h3,h4')
                    ?.innerText?.trim() || a.getAttribute('title') || slug.replace(/-/g, ' '),
                price: priceRaw ? Number(priceRaw[0].replace(/\D/g, '')) : null,
                url: new URL(pathname, location.origin).href
            });
            seen.add(pathname);
        }
        return found.slice(0, 50);
    });
}


async function visibleText(page: Page, text: string): Promise<Locator> {
    const l = page.getByText(text, { exact: true });
    const count = Math.min(await l.count(), 30);
    for (let i = 0; i < count; i++) {
        if (await l.nth(i).isVisible().catch(() => false)) return l.nth(i);
    }
    inconclusive('No visible UI control named: ' + text);
}


async function clickText(page: Page, text: string): Promise<void> {
    const l = await visibleText(page, text);
    try { await l.click({ timeout: 6500 }); }
    catch (e) { inconclusive('Cannot click "' + text + '": ' + String(e)); }
    await page.waitForTimeout(950);
}


async function searchBox(page: Page): Promise<Locator> {
    const inputs = page.locator('input');
    const n = await inputs.count();
    for (let i = 0; i < Math.min(n, 30); i++) {
        const l = inputs.nth(i);
        if (!await l.isVisible().catch(() => false)) continue;
        const label = ((await l.getAttribute('placeholder')) || '') + ' ' +
            ((await l.getAttribute('aria-label')) || '');
        const type = (await l.getAttribute('type')) || '';
        if (/tìm|search/i.test(label) || type === 'search') return l;
    }
    inconclusive('Visible search input was not identified');
}


async function selectedItems(page: Page): Promise<Comparison[]> {
    return page.evaluate(() => {
        try {
            const parsed = JSON.parse(localStorage.getItem('ddv-compare') || '{}');
            const arr = parsed?.state?.items;
            return Array.isArray(arr) ? arr.filter(x => x && typeof x === 'object') : [];
        } catch { return []; }
    });
}


function identity(x: Comparison): string {
    return String(x.productId || x.slug || x.name || '');
}


async function compareButton(page: Page, slug: string): Promise<Locator> {
    const ok = await page.evaluate(target => {
        document.querySelectorAll('[data-hunt10-target]').forEach(
            x => x.removeAttribute('data-hunt10-target'));
        const pathname = '/dien-thoai/' + target + '.html';
        for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="/dien-thoai/"]'))) {
            if (new URL(a.href).pathname !== pathname) continue;
            let p: HTMLElement | null = a;
            for (let depth = 0; depth < 11 && p; depth++) {
                const slugs = new Set(Array.from(p.querySelectorAll<HTMLAnchorElement>(
                    'a[href*="/dien-thoai/"]')).map(x => new URL(x.href).pathname)
                    .filter(x => /^\/dien-thoai\/[^/]+\.html$/.test(x)));
                if (slugs.size > 1) break;
                const button = Array.from(p.querySelectorAll<HTMLElement>(
                    'button,[role="button"]')).find(x =>
                    /so sánh|danh sách so sánh/i.test(
                        x.getAttribute('aria-label') || x.innerText || ''));
                if (button) {
                    button.setAttribute('data-hunt10-target', target);
                    return true;
                }
                p = p.parentElement;
            }
        }
        return false;
    }, slug);
    if (!ok) inconclusive('Compare button not identified for ' + slug);
    return page.locator('[data-hunt10-target="' + slug + '"]');
}


async function add(page: Page, slug: string, r: Result): Promise<Comparison[]> {
    await dismissCookie(page);
    const before = await selectedItems(page);
    const button = await compareButton(page, slug);
    try { await button.click({ timeout: 6500 }); }
    catch (e) { inconclusive('Compare click blocked: ' + String(e)); }
    let after: Comparison[] = [];
    for (let i = 0; i < 15; i++) {
        after = await selectedItems(page);
        if (after.length === before.length + 1) break;
        await page.waitForTimeout(350);
    }
    note(r, { action: 'add', slug, before, after });
    if (after.length !== before.length + 1)
        suspect('Product was not added to comparison list: ' + slug);
    return after;
}


async function catalog(page: Page, minimum = 1): Promise<Item[]> {
    await open(page, CATALOG);
    await dismissCookie(page);
    const items = await products(page);
    if (items.length < minimum) inconclusive(
        'Only ' + items.length + ' comparable catalog products identified');
    return items;
}


function sortViolations(items: Item[], ascending: boolean): Observation[] {
    const p = items.filter(x => x.price !== null);
    const errors: Observation[] = [];
    for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i];
        if (a.price === null || b.price === null) continue;
        if (ascending ? a.price > b.price : a.price < b.price)
            errors.push({ before: a, after: b });
    }
    return errors;
}


// 01. NFC vs NFD.
register(1, 'Unicode NFC and NFD search consistency', async (page, r) => {
    const keyword = 'Điện thoại';
    const reference = await search(page, keyword.normalize('NFC'));
    const alternative = await search(page, keyword.normalize('NFD'));
    note(r, { referenceCount: reference.length, otherCount: alternative.length,
        referenceSlugs: reference.map(x => x.slug),
        otherSlugs: alternative.map(x => x.slug) });
    if (!reference.length) inconclusive('NFC reference returned no identifiable cards');
    if (!alternative.length) suspect('NFC shows products but NFD returns no identifiable cards');
});


// 02. Standard spaces vs NBSP.
register(2, 'Normal spaces and NBSP search', async (page, r) => {
    const normal = 'Samsung Galaxy A07 5G';
    const nbsp = normal.replace(/ /g, '\u00A0');
    const a = await search(page, normal);
    const b = await search(page, nbsp);
    const target = a.find(x => /samsung-galaxy-a07-5g/.test(x.slug));
    note(r, { normal, nbspCodePoints: Array.from(nbsp).map(c => c.codePointAt(0)),
        normalSlugs: a.map(x => x.slug), nbspSlugs: b.map(x => x.slug) });
    if (!target) inconclusive('Control search did not identify Galaxy A07 5G');
    if (!b.some(x => x.slug === target.slug))
        suspect('NBSP search lacks the product found using normal spaces');
});


// 03. Search suggestion race.
register(3, 'Stale search autocomplete suggestions', async (page, r) => {
    await open(page, BASE);
    await dismissCookie(page);
    const input = await searchBox(page);
    await input.fill('Samsung');
    await page.waitForTimeout(180);
    await input.fill('iPhone 14');
    await page.waitForTimeout(1800);
    const candidates = page.locator(
        '[role="listbox"],[class*="suggestion"],[class*="autocomplete"]');
    let suggestion = '';
    for (let i = 0; i < Math.min(await candidates.count(), 20); i++) {
        if (await candidates.nth(i).isVisible().catch(() => false)) {
            suggestion = await candidates.nth(i).innerText().catch(() => '');
            if (suggestion.trim()) break;
        }
    }
    const entered = await input.inputValue();
    note(r, { entered, visibleSuggestion: short(suggestion) });
    if (!suggestion) inconclusive('Autocomplete list could not be identified');
    if (entered === 'iPhone 14' && /Samsung/i.test(suggestion) &&
        !/iPhone 14/i.test(suggestion))
        suspect('Old Samsung suggestions remain under new iPhone 14 query');
});


// 04. Whitespace-only search.
register(4, 'Whitespace-only query validation', async (page, r) => {
    await open(page, BASE);
    await dismissCookie(page);
    const input = await searchBox(page);
    await input.fill('   ');
    await input.press('Enter');
    await page.waitForTimeout(1200);
    const q = new URL(page.url()).searchParams.get('q');
    const body = short(await page.locator('body').innerText());
    note(r, { finalUrl: page.url(), queryParameter: q, body });
    if (q !== null && q.length > 0 && q.trim() === '' &&
        !/vui lòng nhập|từ khóa không hợp lệ|chưa nhập/i.test(body))
        suspect('Whitespace-only query is processed as nonempty search');
});


// 05. RAM+storage combined filters.
register(5, 'RAM 8GB and storage 256GB', async (page, r) => {
    await catalog(page, 2);
    const initial = await products(page);
    await clickText(page, 'RAM');
    await clickText(page, '8GB');
    await clickText(page, 'Bộ nhớ trong');
    await clickText(page, '256GB');
    const filtered = await products(page);
    note(r, { beforeCount: initial.length, afterCount: filtered.length,
        finalUrl: page.url(), firstProducts: filtered.slice(0, 20) });
    if (!filtered.length) inconclusive('No filtered cards to compare');
    const wrong = filtered.filter(x =>
        /\b(?:64|128|512)GB\b/i.test(x.name) && !/\b256GB\b/i.test(x.name));
    if (wrong.length)
        inconclusive('Some product cards show a different default memory variant; ' +
            'verify each actual SKU before classifying. Examples: ' +
            wrong.slice(0, 3).map(x => x.name).join('; '));
});


// 06. Real UI sorting.
register(6, 'Sort by current selling price using UI', async (page, r) => {
    await catalog(page, 5);
    await clickText(page, 'Giá tăng dần');
    await page.waitForTimeout(1100);
    const up = (await products(page)).slice(0, 15);
    const ascendingErrors = sortViolations(up, true);
    await clickText(page, 'Giá giảm dần');
    // Chờ nhiều mốc để phân biệt dữ liệu cập nhật chậm và sai thứ tự thật.
    const checkpoints: Array<{ url: string; products: Item[]; errors: Observation[] }> = [];
    for (const delay of [1000, 2000, 2000]) {
        await page.waitForTimeout(delay);
        const snapshot = (await products(page)).slice(0, 15);
        checkpoints.push({
            url: page.url(),
            products: snapshot,
            errors: sortViolations(snapshot, false)
        });
    }
    const down = checkpoints[checkpoints.length - 1].products;
    const descendingErrors = sortViolations(down, false);
    note(r, { up, down, ascendingErrors, descendingErrors,
        descendingCheckpoints: checkpoints, finalUrl: page.url() });
    if (up.length < 5 || down.length < 5)
        inconclusive('Too few comparable product cards for order analysis');
    if (ascendingErrors.length || descendingErrors.length)
        suspect('Possible price-order inversion within compare-enabled cards; ' +
            'review whether cards belong to the primary product grid');
});


// 07. Filter consistency after Back.
register(7, 'RAM filter and Back navigation', async (page, r) => {
    const control = await catalog(page, 2);
    await clickText(page, 'RAM');
    await clickText(page, '8GB');
    const filtered = await products(page);
    if (!filtered.length) inconclusive('RAM filter has no result cards');
    const target = filtered[0];
    const anchor = page.locator('a[href*="/dien-thoai/' + target.slug + '.html"]:visible').first();
    try { await anchor.click({ timeout: 6500 }); }
    catch (e) { inconclusive('Cannot open filtered product: ' + String(e)); }
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1100);
    const restored = await products(page);
    note(r, { controlCount: control.length, filtered: filtered.map(x => x.slug),
        restored: restored.map(x => x.slug), finalUrl: page.url() });
    if (!restored.length) inconclusive('Back navigation returned no identifiable cards');
    if (filtered.map(x => x.slug).join('|') !== restored.map(x => x.slug).join('|'))
        inconclusive('Product results changed after Back; verify active RAM filter UI ' +
            'before considering this a production defect');
});


// 08. Two memory variants.
register(8, 'Compare two memory variants of iPhone 18 Pro', async (page, r) => {
    await open(page, IPHONE);
    await dismissCookie(page);
    const items = await products(page);
    const a = items.find(x => /iphone-18-pro-256gb/i.test(x.slug) &&
        !/max/i.test(x.slug));
    const b = items.find(x => /iphone-18-pro-512gb/i.test(x.slug) &&
        !/max/i.test(x.slug));
    note(r, { availableVariants: items.filter(x =>
            /iphone-18-pro/i.test(x.slug)).slice(0, 10) });
    if (!a || !b) inconclusive('Both 256GB and 512GB Pro variants not identifiable');
    const first = await add(page, a.slug, r);
    const second = await add(page, b.slug, r);
    if (second.length !== 2) suspect('Second memory variant was not retained');
    const identities = second.map(identity);
    if (new Set(identities).size !== 2)
        suspect('Two memory variants share one comparison identity');
    note(r, { selectedAfterFirst: first, selectedAfterSecond: second });
});


// 09. Mobile comparison overlay.
register(9, 'Mobile compare bar obstructs a card', async (page, r) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const items = await catalog(page, 3);
    await add(page, items[0].slug, r);
    await add(page, items[1].slug, r);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    const probes = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="/dien-thoai/"]')).filter(a =>
            /^\/dien-thoai\/[^/]+\.html$/.test(new URL(a.href).pathname));
        return links.map(link => {
            const rect = link.getBoundingClientRect();
            const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
            const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
            const hit = document.elementFromPoint(x, y);
            return {
                href: link.getAttribute('href'), x, y,
                inViewport: rect.width > 0 && rect.height > 0 &&
                    rect.top >= 0 && rect.bottom <= innerHeight,
                blocked: hit !== null && !link.contains(hit) && !hit.contains(link),
                blocker: hit?.outerHTML.slice(0, 300) || ''
            };
        }).filter(x => x.inViewport).slice(-10);
    });
    note(r, { viewport: '360x740', probes });
    const blocked = probes.filter(x => x.blocked &&
        /compare|so sánh/i.test(x.blocker));
    if (!probes.length) inconclusive('No product links fully in viewport for hit-testing');
    if (blocked.length)
        suspect('A visible product link is covered by the comparison bar');
});


// 10. Cross-tab comparison state.
register(10, 'Comparison consistency across two tabs', async (pageA, r) => {
    const items = await catalog(pageA, 3);
    const pageB = await pageA.context().newPage();
    try {
        await open(pageB, CATALOG);
        await dismissCookie(pageB);
        await add(pageA, items[0].slug, r);
        await add(pageA, items[1].slug, r);
        const before = await selectedItems(pageA);
        if (before.length !== 2) inconclusive('Two initial comparison items missing');
        // Không dùng add() ở tab B: hàm đó giả định danh sách phải tăng từ 0 lên 1,
        // trong khi tab B mở trước có thể giữ dữ liệu so sánh cũ.
        const thirdButton = await compareButton(pageB, items[2].slug);
        try {
            await thirdButton.click({ timeout: 6500 });
        } catch (e) {
            inconclusive('Cannot click third compare button: ' + String(e));
        }
        await pageB.waitForTimeout(1000);
        const afterAddB = await selectedItems(pageB);
        note(r, { step: 'Tab B added third product', selectedItems: afterAddB });


        await pageA.reload({ waitUntil: 'domcontentloaded' });
        await pageB.reload({ waitUntil: 'domcontentloaded' });
        const afterA = await selectedItems(pageA);
        const afterB = await selectedItems(pageB);
        note(r, { before, afterA, afterB });
        const lost = before.some(old => !afterA.some(x => identity(x) === identity(old)));
        if (lost) suspect('A previously selected product was lost after cross-tab update');
        if (afterA.map(identity).join('|') !== afterB.map(identity).join('|'))
            suspect('Tabs disagree about comparison state after reload');
    } finally {
        await pageB.close().catch(() => {});
    }
});