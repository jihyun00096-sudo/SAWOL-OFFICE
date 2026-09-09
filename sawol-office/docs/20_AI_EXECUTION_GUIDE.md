# STEP 20 — 무료 Mock AI + Provider 선택형 실행 엔진

## 전체 구조

```text
대표 업무지시
→ 비서실장 분석
→ 업무 생성
→ 실행 세션
→ Provider Router
   ├─ mock   (기본 / 무료)
   └─ openai (선택 / 유료)
→ 결과 저장
→ 업무 REVIEW
→ 대표 검수
→ 승인 / 완료
```

## 왜 Mock을 기본으로 두는가

현재는 시스템 개발/검증 단계다.

실제 API를 먼저 연결하면:
- 클릭 테스트마다 비용 발생
- UI 수정 때마다 불필요한 호출
- 프롬프트 구조가 바뀔 때마다 비용 발생
- 장애 원인이 UI인지 API인지 구분하기 어려움

따라서 Provider 계약을 먼저 안정화한다.

## Mock AI의 역할

Mock은 단순 성공 응답이 아니다.

업무 유형과 Context를 읽고 실무 형태의 테스트 결과를 만든다.

예:
- RESEARCH → 조사 범위 / 비교 기준 / 발견사항 / 다음 확인사항
- PLANNING → 목표 / 구조 / 실행안 / 체크리스트
- DEVELOPMENT → 재현 조건 / 원인 후보 / 수정안 / 테스트 계획
- DESIGN → 목표 / 레이아웃 / 정보 위계 / 검수 포인트
- OPERATION → 처리 기준 / 운영 절차 / 예외 / 보고사항

단, 외부 사실을 확인하지 않으므로 실제 사실처럼 단정하지 않는다.

## Provider 전환

`.env.local`

무료 테스트:

```env
SAWOL_AI_PROVIDER=mock
```

실제 OpenAI:

```env
SAWOL_AI_PROVIDER=openai
OPENAI_API_KEY=...
```

## 결과 저장 규칙

Mock과 OpenAI 모두 같은 결과 구조를 반환한다.

- title
- summary
- body
- confidence
- needs_human_review
- sources

그래서 Provider가 바뀌어도 DB/UI는 변하지 않는다.

## STEP20 테스트

1. `SAWOL_AI_PROVIDER=mock`
2. 실행 세션 생성
3. 무료 Mock AI 실행
4. 결과 생성 확인
5. task_runs.status = SUBMITTED
6. tasks.status = REVIEW
7. 실행 기록 재접속 후 결과 유지
8. 승인 흐름 확인
9. 실패 없이 여러 업무 유형 테스트

## STEP20 완료 기준

- [ ] API Key 없이 실행 가능
- [ ] Mock 결과가 업무 유형별로 다름
- [ ] 결과 저장
- [ ] 검수 대기 자동 이동
- [ ] 실행 기록 유지
- [ ] 모바일 정상
- [ ] Provider 표시
- [ ] 실제 OpenAI 전환 구조 준비
