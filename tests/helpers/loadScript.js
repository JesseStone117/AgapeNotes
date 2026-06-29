/**
 * Test helper: loads a browser-style script file into the global scope.
 *
 * Because Jest runs in strict mode, `eval()` and `vm.runInThisContext()`
 * do not leak `const`, `class`, or `let` declarations into the outer scope.
 * This helper wraps the source so that top-level declarations become global.
 */
const fs = require('fs');
const path = require('path');

function loadScript(relativePath) {
    const absPath = path.resolve(__dirname, '..', '..', relativePath);
    let code = fs.readFileSync(absPath, 'utf-8');

    // Remove Windows BOM if present
    if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1);

    // Wrap in a Function so const/class/let declarations become local
    // to the function, then explicitly assign them to globalThis.
    // We:
    //   1. Run the original code inside the function.
    //   2. After running, collect all top-level declarations we care about
    //      and assign them to globalThis so tests can access them.
    //
    // Strategy: replace top-level `const `, `let `, `class ` with `var `
    // so the names leak into the Function scope, then assign them to global.

    // Collect names of top-level const/let/class declarations
    const names = new Set();

    // Match: const NAME or const { destructured } (top-level only — lines starting with const/let/class)
    const declRegex = /^(?:const|let)\s+(\w+)\s*=/gm;
    let m;
    while ((m = declRegex.exec(code)) !== null) {
        names.add(m[1]);
    }
    // Class declarations
    const classRegex = /^class\s+(\w+)/gm;
    while ((m = classRegex.exec(code)) !== null) {
        names.add(m[1]);
    }
    // Top-level function declarations
    const funcRegex = /^function\s+(\w+)/gm;
    while ((m = funcRegex.exec(code)) !== null) {
        names.add(m[1]);
    }

    // Replace const/let with var so they leak out of blocks inside eval
    let modified = code
        .replace(/^const /gm, 'var ')
        .replace(/^let /gm, 'var ');

    // Build assignments to globalThis
    const assignments = Array.from(names)
        .map(n => `if (typeof ${n} !== 'undefined') globalThis.${n} = ${n};`)
        .join('\n');

    // Execute in an indirect eval (sloppy mode) so var declarations leak
    const wrapped = modified + '\n' + assignments;
    (0, eval)(wrapped);
}

module.exports = { loadScript };
