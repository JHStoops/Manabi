// node-pg-migrate 9 is ESM only and uses import.meta, which Jest's CommonJS loader cannot run or
// transpile. Load it with Node's own require (require(esm) works on Node 24) instead.
module.exports = process.getBuiltinModule('node:module').createRequire(__filename)(
  'node-pg-migrate',
);
