'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const targets = {
    esm: {
        packageJsonPath: path.join(root, 'dist', 'esm', 'package.json'),
        type: 'module'
    },
    cjs: {
        packageJsonPath: path.join(root, 'dist', 'cjs', 'package.json'),
        type: 'commonjs'
    }
};

function writePackageType(target) {
    const config = targets[target];
    fs.mkdirSync(path.dirname(config.packageJsonPath), { recursive: true });
    fs.writeFileSync(config.packageJsonPath, `${JSON.stringify({ type: config.type })}\n`, 'utf8');
}

function main() {
    const target = (process.argv[2] || '').trim();
    if (!target || !Object.prototype.hasOwnProperty.call(targets, target)) {
        console.error('Invalid build target. Expected one of: esm, cjs.');
        process.exit(1);
    }
    writePackageType(target);
}

main();
