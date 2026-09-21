import { AccessibilityInfo, Platform, ToastAndroid } from 'react-native';

/**
 * 저장·수정·삭제가 **성공했을 때** 알리는 유일한 통로.
 *
 * 실패와 삭제 전 확인은 `Alert`가 맡는다. 성공은 사용자가 할 일이 없으므로
 * 화면을 막지 않고 지나가는 것이 맞고, 실패는 읽고 다시 시도해야 하므로
 * 막아야 한다. **이 경계를 흐리지 않는다.**
 *
 * 언제 부르는가 — **DB에 행이 실제로 생기거나 바뀌었을 때만** 부른다.
 * 화면 모드처럼 결과가 즉시 눈에 보이는 설정은 여기 해당하지 않는다.
 * DELETE는 `true`를 돌려받은 경우에만 부른다. 이미 지워진 행을 지우면
 * 아무 일도 없었으므로 "삭제했습니다"는 거짓말이 된다.
 * (INSERT·UPDATE는 오류 없이 끝나면 성공으로 본다. UPDATE는 바뀐 행 수를
 *  돌려주지 않아 없는 id를 고쳐도 조용히 지나가지만, 목록에서 고르는 흐름이라
 *  그 경합은 드물다.)
 *
 * 문구 — 두 계열이 있고, 섞지 않는다.
 * - 빠른 기록은 **무엇을** 남겼는지 말한다. 고른 값이 화면에 남지 않기 때문이다.
 *   `모유 왼쪽으로 기록했습니다`
 * - 폼은 **무엇을 했는지** 말한다. 방금 본 화면이 무엇인지 말해준다.
 *   `수유 기록을 저장했습니다`
 *
 * 길이 — Android 12부터 시스템 Toast는 앱 아이콘과 함께 최대 두 줄로 잘린다.
 * 시각이나 수치를 덧붙이지 않는다.
 */
export function showSuccessMessage(message: string): void {
  if (Platform.OS === 'android') {
    // Android는 시스템 Toast의 접근성 처리를 사용한다.
    // 별도 낭독은 중복될 수 있어 호출하지 않는다.
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  // **임시 fallback이다. 완성된 iOS UX가 아니다.** (웹도 여기로 온다.)
  //
  // iOS에는 Toast에 대응하는 시스템 API가 없고 `@expo/ui`의 SwiftUI 쪽에도
  // 없다 — 거기 있는 것(`Alert`, `ConfirmationDialog`, `Popover`)은 모두
  // 조작을 요구하거나 화면을 차지한다. 그래서 지금은 낭독만 남긴다.
  // **화면을 보는 iOS 사용자에게는 성공 메시지가 보이지 않는다.**
  // iOS 배포를 준비할 때 이 자리에 시각적 배너를 붙인다.
  //
  // (`ToastAndroid`는 iOS에서 크래시하지 않고 경고만 찍는 fallback이지만,
  //  그 경고가 저장할 때마다 쌓이므로 부르지 않는다.)
  AccessibilityInfo.announceForAccessibility(message);
}
