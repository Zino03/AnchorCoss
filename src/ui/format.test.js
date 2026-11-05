import { describe, it, expect } from "vitest";
import { countByState, sortByPriority, fmtAgo, fmtG } from "./format.js";

const st = (name, state, score, flags = []) => ({ id: name, name, judgement: { state, score, flags } });

describe("countByState", () => {
  it("상태별 개수", () => {
    const c = countByState([st("a", "normal", 1), st("b", "danger", 90), st("c", "danger", 95), st("d", "check", null)]);
    expect(c).toEqual({ normal: 1, warn: 0, danger: 2, check: 1 });
  });
});

describe("sortByPriority", () => {
  it("점수 내림차순, 점검 필요는 맨 아래, 동점이면 우천 우선", () => {
    const list = [
      st("A", "check", null),
      st("B", "normal", 10),
      st("C", "danger", 100),
      st("D", "danger", 100, ["raining"]),
      st("E", "warn", 60),
    ];
    expect(sortByPriority(list).map((s) => s.name)).toEqual(["D", "C", "E", "B", "A"]);
  });

  it("원본 배열은 바꾸지 않는다", () => {
    const list = [st("B", "normal", 1), st("A", "normal", 2)];
    sortByPriority(list);
    expect(list[0].name).toBe("B");
  });
});

describe("fmtAgo / fmtG", () => {
  it("경과 시간", () => {
    expect(fmtAgo(100_000, 90_000)).toBe("방금");
    expect(fmtAgo(10 * 60_000, 0)).toBe("10분 전");
    expect(fmtAgo(3 * 3600_000, 0)).toBe("3시간 전");
    expect(fmtAgo(0, null)).toBe("수신 없음");
  });

  it("중량", () => {
    expect(fmtG(1234.4)).toBe("1,234g");
    expect(fmtG(null)).toBe("—");
  });
});
