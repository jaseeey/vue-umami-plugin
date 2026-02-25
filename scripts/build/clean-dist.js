'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const targets = {
    all: path.join(root, 'dist'),
    esm: path.join(root, 'dist', 'esm'),
    cjs: path.join(root, 'dist', 'cjs')
};

function removeDirectory(directoryPath) {
    if (!fs.existsSync(directoryPath)) return;
    fs.rmSync(directoryPath, { recursive: true, force: true });
}

function main() {
    const target = (process.argv[2] || 'all').trim();
    if (!Object.prototype.hasOwnProperty.call(targets, target)) {
        console.error(`Invalid build target "${target}". Expected one of: all, esm, cjs.`);
        process.exit(1);
    }
    removeDirectory(targets[target]);
}

main();
