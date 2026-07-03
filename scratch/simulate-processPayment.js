const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitIdx = trimmed.indexOf('=');
    if (splitIdx === -1) continue;
    const key = trimmed.slice(0, splitIdx).trim();
    let val = trimmed.slice(splitIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

// Set up alias path routing because next.js paths like '@/types' require resolving
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id.startsWith('@/')) {
    return originalRequire.apply(this, [path.join(__dirname, '../src', id.slice(2))]);
  }
  return originalRequire.apply(this, arguments);
};

// Set TS node support to directly require TS files if possible, or compile/resolve them.
// We can register ts-node, or since we only need to test processPayment, we can import
// the compiled or raw JS logic. Wait! Let's just import the firebase-admin / processPayment
// function logic but translate it to JS, or register ts-node.
// Since vitest is installed, we can also write a test in vitest that calls processPayment!
// Vitest supports importing TS files natively, handles env loading, aliases, and runs in node!
// That's much cleaner than configuring module resolvers manually.
