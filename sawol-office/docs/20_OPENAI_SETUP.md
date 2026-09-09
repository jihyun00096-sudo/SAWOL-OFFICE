# STEP 20 — AI Provider 설정

## 현재 권장: 무료 Mock AI

개발/테스트 단계에서는 `.env.local`에 아래 한 줄만 추가합니다.

```env
SAWOL_AI_PROVIDER=mock
```

API Key는 필요 없습니다.

이 상태에서:

- 실행 세션 생성
- AI 실행
- 결과 저장
- 검수 대기
- 승인
- 완료

전체 흐름을 무료로 테스트할 수 있습니다.

---

## 실제 OpenAI로 전환

나중에 운영 테스트를 할 때:

```env
SAWOL_AI_PROVIDER=openai
OPENAI_API_KEY=...
```

권장 설정:

```env
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=medium
OPENAI_MAX_OUTPUT_TOKENS=5000
OPENAI_ENABLE_WEB_SEARCH=true
```

환경변수 변경 후 서버를 재시작합니다.

```bash
Ctrl+C
npm run dev
```

---

## 중요한 보안 규칙

절대로 다음처럼 만들지 않습니다.

```env
NEXT_PUBLIC_OPENAI_API_KEY=...
```

API Key는 서버에서만 사용해야 합니다.

---

## Provider 구조

현재:

```text
mock
openai
```

향후 추가 가능:

```text
gemini
claude
local
```

Route와 UI를 다시 만드는 대신 Provider 어댑터만 추가하면 됩니다.
