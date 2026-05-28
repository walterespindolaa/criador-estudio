import { describe, it, expect } from "vitest";
import { deriveSubStatus, canAccess, daysLeftInTrial } from "./subscription-status";

const FIXED_NOW = new Date("2026-05-28T12:00:00Z");
const daysFromFixed = (d: number) =>
  new Date(FIXED_NOW.getTime() + d * 86400000).toISOString();

describe("deriveSubStatus", () => {
  it("retorna 'active' quando subscriptionStatus = active", () => {
    expect(
      deriveSubStatus({ subscriptionStatus: "active", trialEndsAt: null, now: FIXED_NOW }),
    ).toBe("active");
  });

  it("admin sempre retorna 'active', ignorando subscription/trial", () => {
    expect(
      deriveSubStatus({
        role: "admin",
        subscriptionStatus: null,
        trialEndsAt: daysFromFixed(-30),
        now: FIXED_NOW,
      }),
    ).toBe("active");
  });

  it("retorna 'canceled' quando subscriptionStatus = canceled", () => {
    expect(
      deriveSubStatus({ subscriptionStatus: "canceled", trialEndsAt: null, now: FIXED_NOW }),
    ).toBe("canceled");
  });

  it("retorna 'trial_active' quando trial termina daqui a 10 dias", () => {
    expect(
      deriveSubStatus({
        subscriptionStatus: null,
        trialEndsAt: daysFromFixed(10),
        now: FIXED_NOW,
      }),
    ).toBe("trial_active");
  });

  it("retorna 'trial_expiring' quando trial termina em 3 dias ou menos", () => {
    expect(
      deriveSubStatus({
        subscriptionStatus: null,
        trialEndsAt: daysFromFixed(2),
        now: FIXED_NOW,
      }),
    ).toBe("trial_expiring");
  });

  it("retorna 'trial_expired' quando trial já passou", () => {
    expect(
      deriveSubStatus({
        subscriptionStatus: null,
        trialEndsAt: daysFromFixed(-1),
        now: FIXED_NOW,
      }),
    ).toBe("trial_expired");
  });

  it("retorna 'blocked' sem trial e sem subscription", () => {
    expect(
      deriveSubStatus({ subscriptionStatus: null, trialEndsAt: null, now: FIXED_NOW }),
    ).toBe("blocked");
  });

  it("subscription active tem precedência sobre trial expirado", () => {
    expect(
      deriveSubStatus({
        subscriptionStatus: "active",
        trialEndsAt: daysFromFixed(-100),
        now: FIXED_NOW,
      }),
    ).toBe("active");
  });
});

describe("canAccess", () => {
  it("libera trial_active, trial_expiring e active", () => {
    expect(canAccess("trial_active")).toBe(true);
    expect(canAccess("trial_expiring")).toBe(true);
    expect(canAccess("active")).toBe(true);
  });
  it("bloqueia trial_expired, canceled e blocked", () => {
    expect(canAccess("trial_expired")).toBe(false);
    expect(canAccess("canceled")).toBe(false);
    expect(canAccess("blocked")).toBe(false);
  });
});

describe("daysLeftInTrial", () => {
  it("retorna 0 quando trialEndsAt é null/undefined", () => {
    expect(daysLeftInTrial(null, FIXED_NOW)).toBe(0);
    expect(daysLeftInTrial(undefined, FIXED_NOW)).toBe(0);
  });
  it("retorna número positivo arredondado para cima", () => {
    expect(daysLeftInTrial(daysFromFixed(5), FIXED_NOW)).toBe(5);
  });
  it("nunca retorna negativo (clamps em 0)", () => {
    expect(daysLeftInTrial(daysFromFixed(-10), FIXED_NOW)).toBe(0);
  });
});
