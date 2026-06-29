import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(rootDir, 'dist');
const passthroughDirs = ['icons', 'js', 'styles'];
const rootAssets = ['manifest.json'];
const buildId = process.env.VITE_APP_BUILD_ID || new Date().toISOString();

function copyDirectory(source, destination) {
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });

    for (const entry of readdirSync(source, { withFileTypes: true })) {
        const from = join(source, entry.name);
        const to = join(destination, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(from, to);
        } else {
            copyFileSync(from, to);
        }
    }
}

function collectOutputAssets() {
    const assets = new Set(['/']);
    const stack = [outDir];

    while (stack.length > 0) {
        const current = stack.pop();

        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const absolutePath = join(current, entry.name);

            if (entry.isDirectory()) {
                stack.push(absolutePath);
                continue;
            }

            const assetPath = relative(outDir, absolutePath).replaceAll('\\', '/');
            if (assetPath !== 'sw.js') {
                assets.add(`/${assetPath}`);
            }
        }
    }

    return Array.from(assets).sort();
}

function agapeNotesStaticBuild() {
    return {
        name: 'agapenotes-static-build',
        apply: 'build',
        closeBundle() {
            for (const dir of passthroughDirs) {
                copyDirectory(resolve(rootDir, dir), resolve(outDir, dir));
            }

            for (const file of rootAssets) {
                copyFileSync(resolve(rootDir, file), resolve(outDir, file));
            }

            const serviceWorkerSource = readFileSync(resolve(rootDir, 'sw.js'), 'utf8');
            const serviceWorkerOutput = serviceWorkerSource
                .replace(/const BUILD_ID = '.*?';/, `const BUILD_ID = ${JSON.stringify(buildId)};`)
                .replace(
                    /const STATIC_ASSETS = \[[\s\S]*?\];/,
                    `const STATIC_ASSETS = ${JSON.stringify(collectOutputAssets(), null, 4)};`
                );

            mkdirSync(outDir, { recursive: true });
            writeFileSync(resolve(outDir, 'sw.js'), serviceWorkerOutput);
        }
    };
}

export default defineConfig({
    build: {
        outDir,
        emptyOutDir: true
    },
    server: {
        host: '127.0.0.1'
    },
    preview: {
        host: '127.0.0.1'
    },
    plugins: [agapeNotesStaticBuild()]
});
