import { describe, it, expect, vi } from "vitest";
import {
  latLngToGrid,
  ncstBaseTime,
  buildNcstUrl,
  parseNcst,
  parseRainMm,
  fetchNcst,
  KmaError,
} from "./kma.js";

// 2026-11-05 17:xx KST 실제 응답 (충북대가 아닌 테스트 격자 73,134)
const SAMPLE = JSON.stringify({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
    body: {
      dataType: "JSON",
      items: {
        item: [
          ["PTY", "0"], ["REH", "39"], ["RN1", "0"], ["T1H", "17.8"],
          ["UUU", "0.9"], ["VEC", "228"], ["VVV", "0.8"], ["WSD", "1.2"],
        ].map(([category, obsrValue]) => ({ baseDate: "20261105", baseTime: "1700", category, nx: 73, ny: 134, obsrValue })),
      },
    },
  },
});

const KST = (iso) => Date.parse(`${iso}+09:00`);

describe("latLngToGrid", () => {
  it("기상청 공식 격자와 일치", () => {
    expect(latLngToGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 }); // 서울시청
    expect(latLngToGrid(36.6286, 127.4561)).toEqual({ nx: 68, ny: 106 }); // 청주 충북대 부근
  });
});

describe("ncstBaseTime", () => {
  it("40분 이후면 그 시각, 이전이면 한 시간 전", () => {
    expect(ncstBaseTime(KST("2026-11-05T17:45:00"))).toEqual({ baseDate: "20261105", baseTime: "1700" });
    expect(ncstBaseTime(KST("2026-11-05T17:10:00"))).toEqual({ baseDate: "20261105", baseTime: "1600" });
  });

  it("자정 직후는 전날 23시", () => {
    expect(ncstBaseTime(KST("2026-11-06T00:20:00"))).toEqual({ baseDate: "20261105", baseTime: "2300" });
  });

  it("hoursBack으로 더 이전", () => {
    expect(ncstBaseTime(KST("2026-11-05T17:45:00"), 1).baseTime).toBe("1600");
  });
});

describe("buildNcstUrl", () => {
  it("Decoding 키를 인코딩해서 넣는다", () => {
    const u = buildNcstUrl({ key: "a+b/c==", nx: 68, ny: 106, baseDate: "20261105", baseTime: "1700" });
    expect(u.toString()).toContain("serviceKey=a%2Bb%2Fc%3D%3D");
    expect(u.searchParams.get("nx")).toBe("68");
    expect(u.searchParams.get("dataType")).toBe("JSON");
  });
});

describe("parseRainMm", () => {
  it("숫자·예보형 문자열·결측", () => {
    expect(["0", "1.5", "강수없음", "1mm 미만", "30.0~50.0mm", "50.0mm 이상", "-998.9", null].map(parseRainMm)).toEqual([
      0, 1.5, 0, 0.5, 30, 50, 0, 0,
    ]);
  });
});

describe("parseNcst", () => {
  it("실제 응답 파싱", () => {
    expect(parseNcst(SAMPLE)).toEqual({
      baseDate: "20261105",
      baseTime: "1700",
      nx: 73,
      ny: 134,
      rainMm: 0,
      pty: 0,
      ptyLabel: "강수 없음",
      tempC: 17.8,
      humidity: 39,
      windMs: 1.2,
    });
  });

  it("resultCode 오류", () => {
    const bad = JSON.stringify({ response: { header: { resultCode: "10", resultMsg: "INVALID_REQUEST_PARAMETER_ERROR" } } });
    expect(() => parseNcst(bad)).toThrow(KmaError);
    expect(() => parseNcst(bad)).toThrow(/10/);
  });

  it("인증키 오류는 XML로 온다", () => {
    const xml =
      "<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>" +
      "<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>";
    try {
      parseNcst(xml);
      expect.unreachable();
    } catch (e) {
      expect(e.code).toBe("30");
      expect(e.message).toContain("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    }
  });
});

describe("fetchNcst", () => {
  const ok = (text) => ({ ok: true, status: 200, text: async () => text });
  const noData = JSON.stringify({ response: { header: { resultCode: "03", resultMsg: "NO_DATA" } } });

  it("정상 조회", async () => {
    const f = vi.fn(async () => ok(SAMPLE));
    const r = await fetchNcst({ key: "k", nx: 68, ny: 106, now: KST("2026-11-05T17:45:00"), fetchImpl: f });
    expect(r.tempC).toBe(17.8);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0].searchParams.get("base_time")).toBe("1700");
  });

  it("NO_DATA면 한 시간 전으로 재시도", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok(noData)).mockResolvedValueOnce(ok(SAMPLE));
    await fetchNcst({ key: "k", nx: 68, ny: 106, now: KST("2026-11-05T17:45:00"), fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][0].searchParams.get("base_time")).toBe("1600");
  });

  it("HTTP 오류", async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500, text: async () => "" }));
    await expect(fetchNcst({ key: "k", nx: 1, ny: 1, fetchImpl: f })).rejects.toThrow(/HTTP500/);
  });
});
