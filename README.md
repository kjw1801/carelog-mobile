# Carelog

육아 중 한 손으로 빠르게 수유·기저귀·수면을 기록하는 Android 앱.

**현재 상태:** Android V1 개발 중, Google Play 출시 준비 중.

## 핵심 기능

- 수유·기저귀·수면 기록과 수정·삭제
- 오늘 요약 — 마지막 수유로부터 경과 시간, 오늘의 횟수와 수면 시간
- 계정이나 자체 서버 동기화 없이 앱의 SQLite에 로컬 저장

## 기술 스택

React Native 0.86 / Expo SDK 57 / TypeScript / Expo Router / expo-sqlite

## 실행 방법

```bash
npm install
npx expo start --go
```

`expo-dev-client`가 설치돼 있어 `--go` 없이 실행하면 개발 빌드를 찾는다.
자체 패키지 환경에서 확인하려면 개발 빌드를 만든다.

```bash
eas build --platform android --profile development
# 만들어진 APK를 기기에 설치한 뒤
npx expo start --dev-client
```

## 범위

V1은 Android 전용이다. 계획은 [docs/PLAN.md](docs/PLAN.md)에 있다.

출시 후 스크린샷과 주요 설계 판단을 이 문서에 추가한다.
