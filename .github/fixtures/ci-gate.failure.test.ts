import { expect, it } from "vitest";

it("controlled failure: a failed test must block the dependent deployment job", () => {
  expect("failed verification must not publish").toBe("all checks passed");
});
