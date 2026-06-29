import { AsyncLocalStorage } from "node:async_hooks";

// Carries the current request's owner id through async calls so a single shared
// Repository instance can scope every query per-request without threading the id
// through every method. Set once per request by the auth middleware.
export const ownerContext = new AsyncLocalStorage<string>();

export function currentOwner(fallback = "owner-default") {
  return ownerContext.getStore() ?? fallback;
}
