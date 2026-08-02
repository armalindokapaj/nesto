// Next.js aliases the real "server-only" package to a no-op at build time
// when bundling for the server; Vitest has no such special-casing, so this
// stub stands in for it in unit tests instead of stripping the guard from
// application code.
export {};
