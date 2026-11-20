import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { adminReadinessAllowed, usageBlockForRequest } from "../src/routes";
import { ownerContext } from "../src/context";
import { designPartnerReadiness } from "../src/readiness";

const trackedEnv = [
  "ADMIN_TOKEN",
  "AUTH_REQUIRED",
  "DATABASE_URL",
  "DEFAULT_DAILY_COST_LIMIT_USD",
  "DEFAULT_MONTHLY_COST_LIMIT_USD",
  "INVITE_CODE",
  "MODEL_DRAFT",
  "MODEL_PROFILE",
  "OPENROUTER_API_KEY"
] as const;

const previousEnv: Partial<Record<(typeof trackedEnv)[number], string>> = {};

beforeEach(() => {
  for (const key of trackedEnv) {
    previousEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of trackedEnv) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});

async function freshRepo() {
  return new Repository(await openDatabase());
}

describe("design-partner usage limits", () => {
  it("summarizes owner spend from generation records and caps", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      await repo.createGenerationRecord({
        stage: "draft",
        content: "draft",
        provider: "openrouter",
        model: "test/model",
        retrievedPostIds: [],
        corpusSegmentIds: [],
        citationFlags: [],
        usage: { cost: 0.42 }
      });
      await repo.setUsageLimitForOwner("alice", { dailyLimitUsd: 1, monthlyLimitUsd: 5 });
    });
    await ownerContext.run("bob", () =>
      repo.createGenerationRecord({
        stage: "draft",
        content: "bob draft",
        provider: "openrouter",
        model: "test/model",
        retrievedPostIds: [],
        corpusSegmentIds: [],
        citationFlags: [],
        usage: { cost: 1.5 }
      })
    );

    const status = await repo.usageStatus("openrouter", "alice");
    expect(status.dailySpendUsd).toBe(0.42);
    expect(status.monthlySpendUsd).toBe(0.42);
    expect(status.dailyLimitUsd).toBe(1);
    expect(status.monthlyLimitUsd).toBe(5);
    expect(status.blocked).toBe(false);
  });

  it("blocks live generation when caps are reached, but never blocks mock mode", async () => {
    const repo = await freshRepo();
    process.env.AUTH_REQUIRED = "false";
    process.env.DEFAULT_DAILY_COST_LIMIT_USD = "0";
    process.env.OPENROUTER_API_KEY = "test-key";

    const blocked = await usageBlockForRequest(repo, "POST", "/generate/frame");
    expect(blocked).toMatchObject({ statusCode: 402, error: expect.stringContaining("Daily spend cap reached") });
    expect(await usageBlockForRequest(repo, "POST", "/package/image")).toMatchObject({ statusCode: 402 });

    delete process.env.OPENROUTER_API_KEY;
    expect(await usageBlockForRequest(repo, "POST", "/generate/frame")).toBeUndefined();
    expect(await usageBlockForRequest(repo, "POST", "/package/image")).toBeUndefined();
  });
});

describe("design-partner activation and feedback", () => {
  it("stores activation events and partner feedback per owner", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      await repo.saveActivationEvent({ type: "entered_create", metadata: { source: "test" } });
      await repo.savePartnerFeedback({ voiceMatch: 5, editEffort: "light", repeatIntent: true, notes: "Close." });
    });
    await ownerContext.run("bob", async () => {
      await repo.saveActivationEvent({ type: "piece_saved" });
      await repo.savePartnerFeedback({ voiceMatch: 2, editEffort: "heavy", repeatIntent: false });
    });

    expect((await repo.listActivationEvents("alice")).map((event) => event.type)).toEqual(["entered_create"]);
    expect((await repo.listPartnerFeedback("alice")).map((feedback) => feedback.notes)).toEqual(["Close."]);
    expect((await repo.listActivationEvents("bob")).map((event) => event.type)).toEqual(["piece_saved"]);
    expect((await repo.listPartnerFeedback("bob")).map((feedback) => feedback.editEffort)).toEqual(["heavy"]);
  });
});

describe("design-partner admin readiness", () => {
  it("requires ADMIN_TOKEN and returns redacted readiness facts", async () => {
    const repo = await freshRepo();
    process.env.ADMIN_TOKEN = "admin-secret";
    process.env.AUTH_REQUIRED = "true";
    process.env.INVITE_CODE = "invite-secret";
    process.env.OPENROUTER_API_KEY = "openrouter-secret";
    process.env.DATABASE_URL = "postgresql://user:password@example.test/db";
    process.env.MODEL_PROFILE = "balanced";
    process.env.MODEL_DRAFT = "anthropic/test-model";

    expect(adminReadinessAllowed(undefined)).toBe(false);
    expect(adminReadinessAllowed("wrong")).toBe(false);
    expect(adminReadinessAllowed("admin-secret")).toBe(true);

    const body = await designPartnerReadiness(repo);
    expect(body).toMatchObject({
      authRequired: true,
      inviteConfigured: true,
      databaseConfigured: true,
      openRouterConfigured: true,
      modelProfile: "balanced",
      modelOverrides: { MODEL_DRAFT: "anthropic/test-model" }
    });
    expect(JSON.stringify(body)).not.toContain("admin-secret");
    expect(JSON.stringify(body)).not.toContain("invite-secret");
    expect(JSON.stringify(body)).not.toContain("openrouter-secret");
    expect(JSON.stringify(body)).not.toContain("password@example.test");
  });
});

describe("public metadata", () => {
  it("uses an absolute production og:image URL", () => {
    const html = readFileSync(new URL("../../client/index.html", import.meta.url), "utf8");
    expect(html).toContain('property="og:image" content="https://co-create-production.up.railway.app/og-image.svg"');
  });
});

describe("waitlist", () => {
  it("stores emails idempotently and counts them", async () => {
    const repo = await freshRepo();
    await repo.addToWaitlist("writer@example.test", "from a friend");
    await repo.addToWaitlist("writer@example.test"); // duplicate is a no-op
    await repo.addToWaitlist("second@example.test");
    expect(await repo.waitlistCount()).toBe(2);
  });
});

describe("durable model profile", () => {
  it("persists the profile setting across repository instances (restart survival)", async () => {
    const db = await openDatabase();
    const repo = new Repository(db);
    expect(await repo.getModelProfileSetting()).toBeUndefined();
    await repo.setModelProfileSetting("balanced");
    const rebooted = new Repository(db); // same store, fresh instance = restart
    expect(await rebooted.getModelProfileSetting()).toBe("balanced");
    await rebooted.setModelProfileSetting("cost-first");
    expect(await repo.getModelProfileSetting()).toBe("cost-first");
  });
});
