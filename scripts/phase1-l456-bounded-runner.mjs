#!/usr/bin/env node

// Phase 1 L4-L6 acceptance traffic must exercise 500 distinct authenticated
// learners, but "near-concurrent" must not be implemented as an artificial
// 500-socket stampede against a database currently configured for 60 direct
// PostgreSQL connections. Keep all 20 hosted-runner shards aligned on the
// shared barrier while limiting each shard to two in-flight HTTP requests.
// Across 20 shards this yields up to 40 simultaneous application requests,
// with all 500 actors participating in the same finishing window.
//
// This wrapper deliberately does not change the underlying acceptance logic,
// credentials, tenant guards, RPCs, evidence budgets, or cleanup semantics.

const MAX_INFLIGHT = 2;
const nativeFetch = globalThis.fetch.bind(globalThis);
let inFlight = 0;
const waiters = [];

async function acquire() {
  if (inFlight < MAX_INFLIGHT) {
    inFlight += 1;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  inFlight += 1;
}

function release() {
  inFlight -= 1;
  const next = waiters.shift();
  if (next) next();
}

globalThis.fetch = async (...args) => {
  await acquire();
  try {
    return await nativeFetch(...args);
  } finally {
    release();
  }
};

await import('./phase1-l456-sharded-acceptance.mjs');
