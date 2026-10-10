import {
  applyPositionFilter,
  computeBounds,
  evaluateBaselineRule,
} from "./baseline.strategy";

describe("evaluateBaselineRule", () => {
  const config = { baseline: 200, bandPercent: 0 };
  const idle = { lastExecutionAt: null, cooldownMs: 0, now: 1_700_000_000_000 };

  it("buys when price is strictly above the 200 baseline", () => {
    const decision = evaluateBaselineRule(config, { ...idle, price: 200.01 });
    expect(decision.action).toBe("BUY");
    expect(decision.reason).toBe("price-above-baseline");
  });

  it("sells when price is strictly below the 200 baseline", () => {
    const decision = evaluateBaselineRule(config, { ...idle, price: 199.99 });
    expect(decision.action).toBe("SELL");
    expect(decision.reason).toBe("price-below-baseline");
  });

  it("holds exactly at 200 until a clear crossing", () => {
    const decision = evaluateBaselineRule(config, { ...idle, price: 200 });
    expect(decision.action).toBe("HOLD");
    expect(decision.reason).toBe("inside-whipsaw-band");
  });

  it("holds inside a configured whipsaw band", () => {
    const decision = evaluateBaselineRule(
      { baseline: 200, bandPercent: 1 },
      { ...idle, price: 201 },
    );
    expect(decision.action).toBe("HOLD");
    expect(computeBounds({ baseline: 200, bandPercent: 1 })).toEqual({
      lowerBound: 198,
      upperBound: 202,
    });
  });
});

describe("applyPositionFilter", () => {
  it("does not stack a second long when already long", () => {
    const result = applyPositionFilter(
      "BUY",
      { side: "long", quantity: 1 },
      "close-only",
    );
    expect(result.permitted).toBe(false);
  });

  it("ignores a sell while flat when short selling is disabled", () => {
    const result = applyPositionFilter("SELL", null, "close-only");
    expect(result.permitted).toBe(false);
  });

  it("opens a short while flat when the operator allows it", () => {
    const result = applyPositionFilter("SELL", null, "open-short");
    expect(result.permitted).toBe(true);
  });
});
