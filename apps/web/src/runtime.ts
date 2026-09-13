import { Buffer } from 'buffer';

// Some Midnight browser bundles still reference the Node Buffer global.
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
