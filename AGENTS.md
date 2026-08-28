# carelog

육아 기록 앱 (Expo SDK 57 / React Native / TypeScript / Expo Router / SQLite).

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

SDK 57에서 실제로 걸린 것:
- `Tabs` **컴포넌트**가 deprecated된 것이 아니다. `expo-router` **루트 패키지의 re-export 경로**가
  deprecated다. `expo-router/js-tabs`에서 가져온다. 두 경로가 가리키는 구현은 동일한 파일이다.
  (네이티브 탭이 필요하면 `expo-router/unstable-native-tabs`의 `NativeTabs`.)

## 작업 방식

계획은 [docs/PLAN.md](docs/PLAN.md)에 있다. 반드시 따른다.

- **화면 전체를 한꺼번에 구현하지 않는다.** 기능 하나를 Today의 추가 기능부터
  SQLite 저장, Records 조회, 수정·삭제까지 세로로 완성한다.
- 수유 → 기저귀 → 수면 순서. 사용자가 직접 실행해 확인한 후에만 다음으로 넘어간다.
- 각 단계가 끝나면 **변경사항 / 실행 방법 / 확인 항목**을 보고하고 멈춘다.
- **커밋 메시지에 `Co-Authored-By` 등 AI 공동 작성자 표시를 넣지 않는다.**
  GitHub 기여자 목록에 올라가고, 지우려면 공개된 히스토리를 다시 써야 한다.
  커밋한 뒤 푸시하기 전에 `git log -1 --format=%B`로 확인한다
  (커밋 전에는 직전 커밋이 보이므로 검증이 되지 않는다). 붙었으면 `git commit --amend`.

## 라우팅 구조

루트는 Stack이고 탭은 `(tabs)` route group 안에 있다. 파일 기반 라우터라
`src/app/` 바로 아래에 파일을 만들면 그대로 라우트가 되므로, 탭에 넣을 화면은
반드시 `(tabs)/` 안에 만든다. 모달은 루트 Stack의 형제로 두고 `presentation: 'modal'`을 준다.

## 데이터 규칙

- **수유는 종류가 필수다.** 모유는 위치(왼쪽·오른쪽·양쪽)가 필수이고 양이 없다.
  분유는 위치가 없고 양이 선택이다. 서로의 열은 `NULL`이어야 하며 DB `CHECK`로
  강제한다. `v4 → v5` 마이그레이션된 기존 기록만 `unspecified`이고, 새 기록은 이 상태로
  저장하지 않는다. DB는 기존 행 때문에 이 값을 허용해야 하므로, 새 생성 금지는
  `insertFeeding`의 타입 경계에서 막는다.
- 수유량은 선택 입력이다. 빈 입력은 `0`이 아니라 **`NULL`로 저장**한다.
  값을 입력하는 경우는 **0보다 큰 정수만** 허용하고 **`0`은 입력 오류로 거부**한다.
  `0ml` 기록은 `마지막 수유` 시각을 갱신해 핵심 숫자를 오염시킨다.
  집계는 **분유량만** 더한다. 모유는 양이 없고 `unspecified`의 양은 종류를 알 수
  없으므로 뺀다. 오늘 분유량을 하나도 입력하지 않았으면 `0ml`이 아니라 숨기거나
  `기록 없음`으로 표시한다.
- **빈 문자열 판정과 숫자 변환을 분리한다.** `Number('')`는 `0`이다.
  `Number(input) || null`은 빈 입력과 진짜 `0` 입력을 둘 다 `null`로 만든다.
- 시각은 epoch milliseconds `INTEGER`. 단 아이 생년월일은 `YYYY-MM-DD` `TEXT`
  (특정 순간이 아니라 달력 날짜라, epoch로 두면 시간대가 바뀔 때 날짜가 밀린다).
- SQLite의 `unixepoch` 계열은 **초 단위**다. 밀리초를 그대로 넘기지 않는다.
  날짜 경계는 JS에서 계산해 `WHERE occurred_at >= ? AND occurred_at < ?`로 조회한다.
- "오늘"은 기기 현지 시간 00:00 이상, 다음 날 00:00 미만.
  끝 시각을 `시작 + 86400000`으로 만들지 않는다 (서머타임 지역에서 깨진다).
- 미래 시각은 저장하지 않는다.
