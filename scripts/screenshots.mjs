#!/usr/bin/env node
/**
 * Regenerates the app screenshots in assets/ using Playwright.
 *
 * Produces:
 *   - assets/screenshot-light.png
 *   - assets/screenshot-dark.png
 *   - assets/Screenshot_Combined.png
 *     (diagonal light/dark composite, filename kept for README compatibility)
 *
 * Usage:
 *   npx playwright install chromium   # one-time browser download
 *   npm run screenshots
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const COMPOSITE_PATH = path.join(
    ASSETS_DIR,
    'Screenshot_Combined.png'
);

const VIEWPORT = { width: 1600, height: 1000 };
const DEVICE_SCALE_FACTOR = 2;

const THEME_STORAGE_KEY = 't4g_config_themePreference';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

function startStaticServer(rootDir) {
    const server = http.createServer(async (req, res) => {
        try {
            const requestUrl = new URL(req.url, 'http://localhost');
            let relPath = decodeURIComponent(requestUrl.pathname);
            if (relPath === '/') relPath = '/index.html';

            const filePath = path.join(rootDir, relPath);
            // Prevent path traversal outside the repo root.
            if (!filePath.startsWith(rootDir)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            const data = await fs.readFile(filePath);
            const ext = path.extname(filePath);
            res.writeHead(200, {
                'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            });
            res.end(data);
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, baseUrl: `http://127.0.0.1:${port}/` });
        });
    });
}

async function captureThemeScreenshot(browser, baseUrl, theme, outPath) {
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });

    // Set the theme preference before the app's init script runs, so it
    // renders directly in the target theme with no flash/toggle click.
    await context.addInitScript(
        ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
        { key: THEME_STORAGE_KEY, value: theme }
    );

    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    await page
        .getByRole('button', { name: /Load Demo Data/ })
        .click();

    await page
        .getByText(/Showing \d+ of \d+ transactions/)
        .waitFor({ state: 'visible' });

    await page.screenshot({ path: outPath, fullPage: true });

    await context.close();
}

async function compositeDiagonal(browser, lightPath, darkPath, outPath) {
    const [lightBuffer, darkBuffer] = await Promise.all([
        fs.readFile(lightPath),
        fs.readFile(darkPath),
    ]);
    const lightDataUrl = `data:image/png;base64,${lightBuffer.toString('base64')}`;
    const darkDataUrl = `data:image/png;base64,${darkBuffer.toString('base64')}`;

    const page = await browser.newPage();
    const compositeDataUrl = await page.evaluate(
        async ({ lightSrc, darkSrc }) => {
            function loadImage(src) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                });
            }

            const [lightImg, darkImg] = await Promise.all([
                loadImage(lightSrc),
                loadImage(darkSrc),
            ]);

            const width = Math.max(lightImg.width, darkImg.width);
            const height = Math.max(lightImg.height, darkImg.height);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Light theme as the base layer.
            ctx.drawImage(lightImg, 0, 0);

            // Dark theme clipped to the lower-left triangle
            // (top-left corner -> bottom-right corner split).
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, height);
            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(darkImg, 0, 0);
            ctx.restore();

            // // Dark theme clipped to the lower-right triangle
            // // (top-right corner -> bottom-left corner split).
            // ctx.save();
            // ctx.beginPath();
            // ctx.moveTo(width, 0);
            // ctx.lineTo(width, height);
            // ctx.lineTo(0, height);
            // ctx.closePath();
            // ctx.clip();
            // ctx.drawImage(darkImg, 0, 0);
            // ctx.restore();

            return canvas.toDataURL('image/png');
        },
        { lightSrc: lightDataUrl, darkSrc: darkDataUrl }
    );

    const base64Data = compositeDataUrl.replace(/^data:image\/png;base64,/, '');
    await fs.writeFile(outPath, Buffer.from(base64Data, 'base64'));

    await page.close();
}

async function main() {
    await fs.mkdir(ASSETS_DIR, { recursive: true });

    const { server, baseUrl } = await startStaticServer(ROOT_DIR);
    const browser = await chromium.launch();

    try {
        const lightPath = path.join(ASSETS_DIR, 'screenshot-light.png');
        const darkPath = path.join(ASSETS_DIR, 'screenshot-dark.png');

        await captureThemeScreenshot(browser, baseUrl, 'light', lightPath);
        console.log(`Wrote ${path.relative(ROOT_DIR, lightPath)}`);

        await captureThemeScreenshot(browser, baseUrl, 'dark', darkPath);
        console.log(`Wrote ${path.relative(ROOT_DIR, darkPath)}`);

        await compositeDiagonal(browser, lightPath, darkPath, COMPOSITE_PATH);
        console.log(`Wrote ${path.relative(ROOT_DIR, COMPOSITE_PATH)}`);
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
