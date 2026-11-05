// 4상태 판정
export const STATES = {
  NORMAL: "normal",        // 정상
  TOP_CLOG: "top_clog",    // 격자 위 막힘
  BOTTOM_CLOG: "bottom_clog", // 하부 막힘
  FLOOD_RISK: "flood_risk",   // 침수 위험
};

export const STATE_LABEL = {
  normal: "정상",
  top_clog: "격자 위 막힘",
  bottom_clog: "하부 막힘",
  flood_risk: "침수 위험",
};
