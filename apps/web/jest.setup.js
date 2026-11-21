// jsdom has no TextEncoder/TextDecoder, which react-router 7 needs at import time.
const { TextDecoder, TextEncoder } = require('node:util');

Object.assign(globalThis, { TextDecoder, TextEncoder });
