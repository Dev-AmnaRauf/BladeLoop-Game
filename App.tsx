/**
 * BladeLoop -- rotate a bouncing ball around the rods and thread the blades.
 *
 * @format
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './src/ui/theme';
import GameScreen from './src/ui/GameScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <GameScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
});
