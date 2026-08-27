import { StyleSheet, Text, View } from 'react-native';

export default function RecordsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>아직 기록이 없습니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontSize: 16,
    color: '#8a8a8e',
  },
});
