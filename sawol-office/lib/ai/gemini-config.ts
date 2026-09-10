export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * SAWOL OFFICE Gemini 모델은 GEMINI_MODEL 하나만 사용합니다.
 * 연구/협업/반려 재작업도 별도 구형 모델로 강등하지 않습니다.
 */
export function getConfiguredGeminiModel() {
  return (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
}
