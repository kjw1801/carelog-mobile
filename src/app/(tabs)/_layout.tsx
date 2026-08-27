import Ionicons from '@expo/vector-icons/Ionicons';
import { PlatformPressable } from 'expo-router/react-navigation';
import { Tabs } from 'expo-router/js-tabs';

/**
 * 탭 버튼의 물결 효과를 항목 안으로 가둔다.
 *
 * 기본값은 `android_ripple: { borderless: true }`인데, borderless는 뷰 경계로
 * 잘리지 않아 옆 탭과 시스템 내비게이션 바까지 번진다. `borderless: false`면
 * 항목 사각형 안에서만 그려진다.
 */
function TabBarButton(props: React.ComponentProps<typeof PlatformPressable>) {
  return <PlatformPressable {...props} android_ripple={{ borderless: false }} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarButton: TabBarButton }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '오늘',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: '기록',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
