/* Install the optional test tool: npm install --prefix .tools --no-save playwright */
const { chromium } = require('../.tools/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const server = require('./preview.cjs');
const root = path.resolve(__dirname, '..');
const widths = [320, 375, 390, 414, 480, 768, 1024, 1280, 1440, 1920, 2560];
const report = { pages: [], interactions: [], failures: [] };
(async () => {
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        let errors = [];
        page.on('pageerror', error => errors.push(error.message));
        for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
            errors = [];
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto(`http://127.0.0.1:4173/${file}`, { waitUntil: 'networkidle' });
            // Scroll through the whole page so lazy images and lower sections are checked too.
            await page.evaluate(async () => {
                document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
                for (let y = 0; y < document.body.scrollHeight; y += 700) {
                    window.scrollTo(0, y);
                    await new Promise(resolve => setTimeout(resolve, 35));
                }
                await Promise.race([
                    Promise.all([...document.images].filter(img => img.getBoundingClientRect().width).map(img => img.decode().catch(() => {}))),
                    new Promise(resolve => setTimeout(resolve, 8000))
                ]);
                window.scrollTo(0, 0);
            });
            const audit = await page.evaluate(() => {
                const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
                return {
                    h1: document.querySelectorAll('h1').length,
                    main: document.querySelectorAll('main').length,
                    footer: document.querySelectorAll('footer').length,
                    footerGroups: document.querySelectorAll('.footer-toggle').length,
                    closeIsButton: document.querySelector('.close-icon')?.tagName === 'BUTTON',
                    duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
                    unnamedInputs: [...document.querySelectorAll('input, textarea, select')].filter(el => !el.labels?.length && !el.getAttribute('aria-label') && el.type !== 'hidden').map(el => el.outerHTML),
                    unnamedButtons: [...document.querySelectorAll('button')].filter(el => !el.textContent.trim() && !el.getAttribute('aria-label')).map(el => el.outerHTML),
                    unnamedLinks: [...document.querySelectorAll('a[href]')].filter(el => !el.textContent.trim() && !el.getAttribute('aria-label') && ![...el.querySelectorAll('img')].some(img => img.alt)).map(el => el.outerHTML),
                    brokenImages: [...document.images].filter(img => img.getBoundingClientRect().width && !img.naturalWidth).map(img => img.getAttribute('src')),
                    localAssets: [...document.querySelectorAll('[src], link[href]')].map(el => el.getAttribute('src') || el.getAttribute('href')).filter(src => !/^(https?:|\/\/|data:)/.test(src)),
                    localLinks: [...document.querySelectorAll('a[href]')].map(el => el.getAttribute('href')).filter(href => /\.html(?:[?#]|$)/.test(href) && !/^https?:/.test(href))
                };
            });
            const checks = [];
            for (const width of widths) {
                await page.setViewportSize({ width, height: 900 });
                await page.waitForTimeout(110);
                const layout = await page.evaluate(() => {
                    const outside = [...document.querySelectorAll('main > section, .footer_wrapper .container, .myNav_content, .bottom-menu > ul > li, .sign_wrapper__content, .payment_left, .payment_right, .table_flax, .product_heading, .whishlist_header')]
                        .filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map(el => el.className);
                    return { scrollWidth: document.documentElement.scrollWidth, outside, mobileMenu: getComputedStyle(document.querySelector('.menu_icon')).display, footerVisible: !document.querySelector('.footer_links').hidden };
                });
                if (layout.scrollWidth > width + 1 || layout.outside.length) report.failures.push({ file, width, layout });
                if (layout.footerVisible !== (width >= 768)) report.failures.push({ file, width, footer: layout.footerVisible });
                checks.push({ width, ...layout });
                if ((width === 390 || width === 1440) && ['index.html', 'product.html', 'cart.html', 'payment.html', 'login.html', 'categories.html'].includes(file)) {
                    await page.screenshot({ path: path.join(root, `artifacts/${file.replace('.html', '')}-${width}.png`), fullPage: true });
                    await page.screenshot({ path: path.join(root, `artifacts/${file.replace('.html', '')}-top-${width}.png`) });
                    if (file === 'index.html') {
                        await page.locator('.collection_wrapper').first().scrollIntoViewIfNeeded();
                        await page.screenshot({ path: path.join(root, `artifacts/home-collection-${width}.png`) });
                        await page.evaluate(() => window.scrollTo(0, 0));
                    }
                }
            }
            const missing = [...new Set([...audit.localAssets, ...audit.localLinks])].filter(src => !fs.existsSync(path.join(root, decodeURIComponent(src.split(/[?#]/)[0]))));
            if (errors.length || missing.length || audit.duplicateIds.length || audit.unnamedInputs.length || audit.unnamedButtons.length || audit.unnamedLinks.length || audit.brokenImages.length || !audit.closeIsButton || audit.h1 !== 1 || audit.main !== 1 || audit.footer !== 1 || audit.footerGroups !== 6) report.failures.push({ file, errors, missing, audit });
            report.pages.push({ file, errors: [...errors], missing, ...audit, checks });
            console.log(file, JSON.stringify({ errors, missing, h1: audit.h1, footer: audit.footer, footerGroups: audit.footerGroups, unnamedInputs: audit.unnamedInputs.length }));
        }
        const check = async (name, fn) => {
            try { await fn(); report.interactions.push({ name, passed: true }); }
            catch (error) { report.failures.push({ name, error: error.message }); }
        };
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
        await check('Mobile navigation, nested menu, focus and Escape', async () => {
            await page.locator('.menu_icon').click();
            assert.equal(await page.locator('.menu_icon').getAttribute('aria-expanded'), 'true');
            await page.locator('.dropBtn > button').first().click();
            await page.locator('.megadropBtn > button').first().click();
            assert.equal(await page.locator('.dropBtn > button').first().getAttribute('aria-expanded'), 'true');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.menu_icon').getAttribute('aria-expanded'), 'false');
            assert.equal(await page.locator('.menu_icon').evaluate(el => el === document.activeElement), true);
        });
        await check('Footer expand/collapse and resize', async () => {
            const toggle = page.locator('.footer-toggle').first();
            await toggle.click();
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
            await toggle.click();
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            await page.setViewportSize({ width: 1440, height: 900 });
            assert.equal(await page.locator('.footer_links').first().isVisible(), true);
            await page.setViewportSize({ width: 390, height: 844 });
        });
        await page.goto('http://127.0.0.1:4173/product.html', { waitUntil: 'networkidle' });
        await check('Filter panel and associated checkbox labels', async () => {
            await page.locator('.filter').click();
            await page.locator('.filter_heading').first().click();
            await page.locator('.filter_select__input label').first().click();
            assert.equal(await page.locator('.filter_select__input input').first().isChecked(), true);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.filter').getAttribute('aria-expanded'), 'false');
        });
        await check('Reduced motion pauses video', async () => {
            assert.equal(await page.locator('video').evaluate(el => el.paused), true);
        });
        await check('Search and empty result state', async () => {
            await page.locator('.search-icon').click();
            await page.locator('.search--input input').fill('no-matching-product-123');
            await page.locator('.search--input input').press('Enter');
            await page.waitForURL('**/product.html?q=*');
            await page.locator('.product_heading .ui-status').waitFor();
            assert.match(await page.locator('.product_heading .ui-status').textContent(), /No results/);
        });
        await page.goto('http://127.0.0.1:4173/cart.html', { waitUntil: 'networkidle' });
        await check('Cart quantity, totals, remove and empty state', async () => {
            await page.locator('[data-step="1"]').first().click();
            assert.match(await page.locator('.cart_total h6').first().textContent(), /2,598/);
            assert.match(await page.locator('.checkout-section_content h6').textContent(), /3,897/);
            await page.locator('.del-btn button').first().click();
            await page.locator('.del-btn button').first().click();
            assert.equal(await page.locator('.cart-empty').isVisible(), true);
        });
        await page.goto('http://127.0.0.1:4173/login.html', { waitUntil: 'networkidle' });
        await check('Password toggle and honest form feedback', async () => {
            await page.locator('#email').fill('test@example.com');
            await page.locator('#password').fill('test-password');
            await page.locator('.password-toggle').click();
            assert.equal(await page.locator('#password').getAttribute('type'), 'text');
            await page.locator('.sign_submit').click();
            assert.match(await page.locator('.sign_form .ui-status').textContent(), /unavailable/);
        });
        await page.goto('http://127.0.0.1:4173/product-details.html', { waitUntil: 'networkidle' });
        await check('Product gallery and exclusive option selection', async () => {
            await page.locator('.vertical_img button').nth(2).click();
            assert.equal(await page.locator('#imgBox').evaluate(el => el.src), await page.locator('.vertical_img img').nth(2).evaluate(el => el.src));
            await page.locator('input[name="size"]').first().check();
            await page.locator('input[name="size"]').nth(1).check();
            assert.equal(await page.locator('input[name="size"]:checked').count(), 1);
        });
        await context.close();
    } finally {
        await browser.close();
        server.close();
        fs.writeFileSync(path.join(root, 'artifacts/browser-report.json'), JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify({ pages: report.pages.length, viewportChecks: report.pages.length * widths.length, interactions: report.interactions, failures: report.failures }, null, 2));
    if (report.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
