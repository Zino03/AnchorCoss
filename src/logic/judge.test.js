import { describe, it, expect } from "vitest";
import { judge } from "./judge.js";
import { STATES } from "./states.js";

describe("judge", () => {
  it("기본값은 정상", () => {
    expect(judge({}).state).toBe(STATES.NORMAL);
  });
});
