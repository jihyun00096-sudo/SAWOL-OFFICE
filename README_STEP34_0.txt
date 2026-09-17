SAWOL OFFICE STEP34.0 — AUTO 운영 안정화

이번 단계 목적
여러 AUTO 업무가 동시에 존재할 때 중복 실행, 일시 오류, 멈춘 worker,
무한 재시도 같은 운영 위험을 줄입니다.

핵심 변경
1. 중복 실행 방지
- worker가 job을 실행하기 전에 원자적으로 RUNNING claim
- 같은 job을 두 cron/request가 동시에 잡아도 한 worker만 실행
- 나머지는 BUSY로 안전하게 건너뜀
- lease_token / lease_started_at 기록

2. stale RUNNING 복구
기존 4분 stale 기준을 8분으로 변경
- Vercel worker maxDuration 300초보다 길게 설정
- 정상적인 장시간 AI 호출을 멈춘 worker로 오인하지 않음
- 실제로 중단된 RUNNING job은 이후 worker가 자동 복구

3. 자동 재시도 + backoff
일시 기술 오류 발생 시 즉시 대표 오류로 보내지 않고:
- 1회 실패 → 1분 후 재시도
- 2회 실패 → 3분 후 재시도
- 3회 연속 실패 → 자동 재시도 중단 + PAUSED

retry_after / consecutive_failures는 기존 metadata JSONB에 저장합니다.

4. 무한 오류 루프 방지
연속 3회 실패하면:
- PAUSED
- retry_exhausted=true
- pause_reason=RETRY_EXHAUSTED
- 대표 확인 대상으로 전환

5. 성공 시 오류 카운터 초기화
업무 단계가 정상 실행되면:
- consecutive_failures=0
- retry_after=null
- retry_exhausted=false
- last_success_at 기록

6. orphan / 상태 불일치 정리
- 업무가 이미 승인 대기 → job도 AWAITING_APPROVAL
- 업무가 이미 완료 → job도 COMPLETED
- 취소 업무 → 자동 큐 종료
- AUTO가 아닌 업무 → PAUSED
- 원본 task가 삭제된 orphan job → 반복 선택되지 않도록 종료

7. 신규 job 생성 race 방어
여러 worker가 동시에 새 AUTO task를 발견해도 unique(task_id) 충돌을
실패로 처리하지 않고 생성된 기존 job을 다시 읽습니다.

변경 파일
- lib/sawol/durable-worker.ts

이번 단계에서 변경하지 않은 것
- SQL 없음
- 환경변수 없음
- npm 변경 없음
- DB 스키마 변경 없음
- AI Provider 변경 없음
- Workflow 생성 규칙 변경 없음
- Discord 변경 없음
- Artifact Worker 변경 없음
- Live Office 변경 없음
- Memory Center 변경 없음

기존 task_autopilot_jobs.metadata JSONB를 사용하므로 migration이 필요 없습니다.

간단 테스트
1. AUTO 업무 하나 생성
2. 평소처럼 승인 대기까지 정상 진행되는지 확인
3. 정상 업무라면 UI 차이는 거의 없어야 정상

운영 중 일시 오류가 생겼을 때
- 바로 영구 FAILED가 되지 않음
- 자동으로 retry_after가 설정됨
- 재실행 성공 시 정상 흐름 복귀
- 같은 오류가 3회 연속이면 대표 확인 상태로 멈춤

의도
SAWOL OFFICE가 나중에 여러 업무를 동시에 돌릴 때
"한 번 오류났다고 끝나는 시스템"도 아니고
"끝없이 비용을 쓰며 무한 재시도하는 시스템"도 아니게 만드는 안전장치입니다.
