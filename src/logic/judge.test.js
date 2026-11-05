import { describe, it, expect } from "vitest";
import { judge } from "./judge.js";
import { STATES, STATE_META, FLAGS, FLAG_LABEL } from "./states.js";
import { TH } from "../config.js";

describe("states", () => {
  it("상태 4종 모두 표시 정보가 있다", () => {
    for (const s of Object.values(STATES)) {
      expect(STATE_META[s]?.label).toBeTruthy();
    }
  });

  it("플래그 모두 라벨이 있다", () => {
    for (const f of Object.values(FLAGS)) {
      expect(FLAG_LABEL[f]).toBeTruthy();
    }
  });
});

describe("config", () => {
  it("임계값 순서가 올바르다", () => {
    expect(TH.WARN_TOTAL_G).toBeLessThan(TH.DANGER_TOTAL_G);
    expect(TH.DANGER_SIDE_G).toBeLessThan(TH.MAX_VALID_G);
    expect(TH.RECOVER_RATIO).toBeGreaterThan(0);
    expect(TH.RECOVER_RATIO).toBeLessThan(1);
  });
});

describe("judge (자리표시자)", () => {
  it("Judgement 포맷을 반환한다", () => {
    const r = judge({});
    expect(r).toMatchObject({ state: STATES.NORMAL, reason: [], flags: [] });
    expect(r.metrics).toHaveProperty("totalG");
  });
});
