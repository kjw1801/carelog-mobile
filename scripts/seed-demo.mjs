/**
 * 스토어 스크린샷용 데모 데이터 SQL을 만든다. **개발 도구다. 앱은 부르지 않는다.**
 *
 * 왜 두는가 — 1.4.0을 준비하면서 데모 DB를 재생성할 방법이 없다는 걸 알았다.
 * 기기에 있는 DB가 전부였고, 그게 날아가면 같은 데이터로 다시 찍을 수 없었다.
 *
 *   node scripts/seed-demo.mjs --confirm-demo-reset > /tmp/seed.sql
 *   node scripts/seed-demo.mjs --confirm-demo-reset --reference-time=2026-09-21T18:30
 *
 * ## 기준 시각
 *
 * 오늘치는 **기준 시각에서 거꾸로** 배치한다. 기기 시계를 과거로 돌리지 않는다.
 * 재현성은 "같은 기준 시각을 주면 같은 DB가 나온다"는 뜻이다 — 절대 시각이
 * 실행마다 달라지는 것은 깨진 게 아니다. 덕분에 언제 찍어도 `마지막 수유`가
 * 항상 `25분 전`으로 나온다.
 *
 * 오늘 가장 이른 기록이 기준에서 15시간 30분 전이므로 **15:30 이후**여야 한다.
 * 그 전이면 기록이 어제로 넘어가 아래 불변식이 막는다.
 *
 *   오늘 수유 5건 · 기저귀 5건 · 수면 3건 510분 · 분유 220ml
 *   마지막 수유 = 기준 - 25분 · 미래 기록 0건 · 수면 구간 겹침 0건
 *
 * ## 기기에 넣는 절차
 *
 * preview·production APK는 debuggable이 아니라 `run-as`가 막힌다. 같은 키스토어로
 * 서명된 **development 빌드를 덮어 설치**하면(서명이 같아 DB가 유지된다) 닿는다.
 *
 * **이 SQL은 네 테이블을 전부 지운다.** WAL 때문에 단순히 뽑았다 넣으면 깨진다.
 *
 *   1. 앱을 `am force-stop`으로 완전히 내린다
 *   2. `carelog.db` · `-wal` · `-shm` 세 파일을 모두 백업해 둔다
 *   3. 맥에서 `PRAGMA wal_checkpoint(TRUNCATE)`로 WAL을 본문에 접는다
 *   4. 시드를 트랜잭션으로 적용한다
 *   5. `PRAGMA integrity_check`가 `ok`, `foreign_key_check`가 0건인지 본다
 *   6. 기기의 `-wal`·`-shm`을 지우고 완성된 `.db` 하나만 넣는다
 *   7. 앱을 켜서 위 불변식대로 보이는지 눈으로 대조한다
 *
 * 그다음 preview APK를 다시 덮어 설치해 실제 출시 코드로 되돌린다.
 *
 * 스키마가 바뀌면 여기 INSERT가 CHECK에 걸린다. 기기에 넣기 전에 `memoryDb()`로
 * 실제 마이그레이션을 돌려 이 SQL을 `execAsync`해 보면 그 자리에서 드러난다.
 */

const NAME = '은하';
/** 촬영일 기준 일령. 원본 스크린샷이 `D+60`이었다. */
const AGE_DAYS = 60;
const MIN = 60_000;

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const raw = arg('reference-time');
const ref = raw ? new Date(raw) : new Date();
if (Number.isNaN(ref.getTime())) {
  console.error(`--reference-time을 읽지 못했다: ${raw}`);
  console.error('예) --reference-time=2026-09-21T18:30');
  process.exit(1);
}

/**
 * `offsetDays`일 전의 현지 `hh:mm`.
 *
 * **epoch에 분을 더해 만들지 않는다.** 자정 epoch에 `hh*60+mm`분을 더하면
 * 서머타임 전환일에 현지 시각이 한 시간 어긋난다. 달력 값으로 한 번에 만들면
 * 엔진이 그날의 오프셋을 적용한다. 날짜 언더플로도 `Date`가 알아서 넘긴다.
 */
const at = (offsetDays, hh, mm) =>
  new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offsetDays, hh, mm, 0, 0).getTime();

/** 오늘 00:00 이상, 내일 00:00 미만. 앱의 `todayRange`와 같은 규칙이다. */
const todayStart = at(0, 0, 0);
const todayEnd = at(-1, 0, 0);

const birth = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - AGE_DAYS);
const pad = (n) => String(n).padStart(2, '0');
// 생년월일은 epoch가 아니라 YYYY-MM-DD TEXT다.
const birthDate = `${birth.getFullYear()}-${pad(birth.getMonth() + 1)}-${pad(birth.getDate())}`;

// ── 오늘 — 기준 시각에서 거꾸로 ──────────────────────────────────────────
// 값은 "기준에서 몇 분 전". 마지막 수유 25분이 화면의 `마지막 수유`가 된다.
const TODAY = {
  // [기준 전 분, 종류, 위치, ml]
  feedings: [
    [25, 'breast', 'right', null],
    [200, 'formula', null, 120],
    [400, 'breast', 'both', null],
    [610, 'formula', null, 100],
    [800, 'breast', 'left', null],
  ],
  diapers: [
    [90, 'pee'],
    [260, 'both'],
    [470, 'poo'],
    [660, 'pee'],
    [900, 'pee'],
  ],
  // [기준 전 분(시작), 길이 분] — 세 구간이 겹치지 않고 합이 510분이다.
  // 여섯 구간이면 기록 목록 열 몇 줄이 전부 수면이 되어 수면 앱처럼 보인다.
  sleeps: [
    [320, 200],
    [680, 160],
    [930, 150],
  ],
};

/**
 * 지난 엿새. 통계 막대 높이만 다르면 되므로 현지 시각을 고정해 둔다.
 * 수면은 오늘과 같이 세 구간으로 두어 목록을 훑어도 배합이 같아 보인다.
 */
const PAST = [
  { days: 6, feeds: 5, diapers: 5, sleeps: [200, 180, 160] },
  { days: 5, feeds: 4, diapers: 4, sleeps: [240, 230, 190] },
  { days: 4, feeds: 5, diapers: 5, sleeps: [210, 200, 174] },
  { days: 3, feeds: 4, diapers: 5, sleeps: [230, 200, 188] },
  { days: 2, feeds: 5, diapers: 4, sleeps: [220, 210, 183] },
  { days: 1, feeds: 5, diapers: 5, sleeps: [200, 180, 148] },
];
const PAST_FEEDINGS = [
  [2, 10, 'formula', null, 100],
  [5, 5, 'breast', 'left', null],
  [7, 40, 'breast', 'both', null],
  [9, 30, 'formula', null, 120],
  [13, 35, 'breast', 'right', null],
];
const PAST_DIAPERS = [
  [1, 20, 'pee'],
  [4, 5, 'both'],
  [6, 50, 'pee'],
  [8, 15, 'poo'],
  [10, 35, 'pee'],
];
/** 지난 날의 수면 시작 시각. 길이는 날마다 다르지만 겹치지 않게 벌려 둔다. */
const PAST_SLEEP_START = [
  [2, 0],
  [8, 0],
  [14, 0],
];

const feedings = [];
const diapers = [];
const sleeps = [];

for (const [before, kind, side, ml] of TODAY.feedings) {
  feedings.push({ at: ref.getTime() - before * MIN, kind, side, ml });
}
for (const [before, kind] of TODAY.diapers) {
  diapers.push({ at: ref.getTime() - before * MIN, kind });
}
for (const [before, mins] of TODAY.sleeps) {
  const start = ref.getTime() - before * MIN;
  sleeps.push({ start, end: start + mins * MIN, mins, today: true });
}

for (const p of PAST) {
  for (const [h, m, kind, side, ml] of PAST_FEEDINGS.slice(0, p.feeds)) {
    feedings.push({ at: at(p.days, h, m), kind, side, ml });
  }
  for (const [h, m, kind] of PAST_DIAPERS.slice(0, p.diapers)) {
    diapers.push({ at: at(p.days, h, m), kind });
  }
  p.sleeps.forEach((mins, i) => {
    const [h, m] = PAST_SLEEP_START[i];
    const start = at(p.days, h, m);
    sleeps.push({ start, end: start + mins * MIN, mins, today: false });
  });
}

// ── 불변식 검사 ──────────────────────────────────────────────────────────
// 여기서 막지 않으면 실행 시각에 따라 데모 모양이 달라진다. 이른 시각에 돌리면
// 오늘 기록 일부가 어제로 넘어가는데, 그 상태로 찍힌 스크린샷은 되돌릴 수 없다.
const inToday = (t) => t >= todayStart && t < todayEnd;
const todayFeedings = feedings.filter((f) => inToday(f.at));
const todayDiapers = diapers.filter((d) => inToday(d.at));
const todaySleeps = sleeps.filter((s) => inToday(s.start));

const sorted = [...todaySleeps].sort((a, b) => a.start - b.start);
const overlaps = sorted.filter((s, i) => i > 0 && s.start < sorted[i - 1].end).length;
const lastFeeding = [...feedings].sort((a, b) => b.at - a.at)[0];

const checks = [
  ['오늘 수유 5건', todayFeedings.length, 5],
  ['오늘 기저귀 5건', todayDiapers.length, 5],
  ['오늘 수면 3건', todaySleeps.length, 3],
  ['오늘 수면 510분', todaySleeps.reduce((a, s) => a + s.mins, 0), 510],
  ['오늘 분유 220ml', todayFeedings.reduce((a, f) => a + (f.ml ?? 0), 0), 220],
  ['마지막 수유 25분 전', Math.round((ref.getTime() - lastFeeding.at) / MIN), 25],
  ['수면 구간 겹침 0건', overlaps, 0],
  [
    '미래 기록 0건',
    feedings.filter((f) => f.at > ref.getTime()).length +
      diapers.filter((d) => d.at > ref.getTime()).length +
      sleeps.filter((s) => s.end > ref.getTime()).length,
    0,
  ],
];

const failed = checks.filter(([, got, want]) => got !== want);
if (failed.length > 0) {
  for (const [label, got, want] of failed) {
    console.error(`✗ ${label} — 실제 ${got}, 기대 ${want}`);
  }
  console.error('\n오늘 가장 이른 기록이 기준에서 15시간 30분 전이다. 기준 시각은 15:30 이후여야 한다.');
  process.exit(1);
}

if (!process.argv.includes('--confirm-demo-reset')) {
  console.error('이 SQL은 feedings·diapers·sleeps·baby를 전부 지운다.');
  console.error('실수로 실제 기록을 날리지 않도록 확인 인자를 요구한다.\n');
  console.error('  node scripts/seed-demo.mjs --confirm-demo-reset > /tmp/seed.sql');
  process.exit(1);
}

// ── SQL ──────────────────────────────────────────────────────────────────
const q = (v) =>
  v === null || v === undefined
    ? 'NULL'
    : typeof v === 'number'
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

const out = [
  'BEGIN;',
  'DELETE FROM feedings;',
  'DELETE FROM diapers;',
  'DELETE FROM sleeps;',
  'DELETE FROM baby;',
  `INSERT INTO baby (id, name, birth_date, updated_at) VALUES (1, ${q(NAME)}, ${q(birthDate)}, ${ref.getTime()});`,
];
for (const f of feedings) {
  out.push(
    'INSERT INTO feedings (occurred_at, kind, side, amount_ml, note, created_at, updated_at) ' +
      `VALUES (${f.at}, ${q(f.kind)}, ${q(f.side)}, ${q(f.ml)}, NULL, ${f.at}, ${f.at});`
  );
}
for (const d of diapers) {
  out.push(
    'INSERT INTO diapers (occurred_at, kind, note, created_at, updated_at) ' +
      `VALUES (${d.at}, ${q(d.kind)}, NULL, ${d.at}, ${d.at});`
  );
}
for (const s of sleeps) {
  out.push(
    'INSERT INTO sleeps (started_at, ended_at, note, created_at, updated_at) ' +
      `VALUES (${s.start}, ${s.end}, NULL, ${s.start}, ${s.start});`
  );
}
out.push('COMMIT;');

const stamp = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(ref.getDate())}T${pad(ref.getHours())}:${pad(ref.getMinutes())}`;
console.error(`✓ 불변식 ${checks.length}건 통과`);
console.error(`  기준 시각 ${stamp}${raw ? ' (지정)' : ' (실행 시각)'} · 생년월일 ${birthDate} (D+${AGE_DAYS})`);
console.log(out.join('\n'));
