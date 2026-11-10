import { expect, it } from "vitest";

it("controlled rehearsal: a failed test must block the dependent publication job", () => {
  expect("failed verification must not publish").toBe("all checks passed");
});
