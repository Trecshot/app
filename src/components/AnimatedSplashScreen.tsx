import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const ICON_SIZE = width * 0.55;

export interface AnimatedSplashScreenProps {
  onAnimationFinish?: () => void;
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const glowOpacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    // Secuencia de encendido tipo tubo LED / Neón
    glowOpacity.value = withSequence(
      withDelay(300, withTiming(0.4, { duration: 70 })), // Primer destello
      withTiming(0.05, { duration: 60 }), // Se apaga casi por completo
      withTiming(0.85, { duration: 90 }), // Segundo destello fuerte
      withTiming(0.2, { duration: 80 }), // Caída breve
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }), // Encendido total
      withDelay(
        700,
        withTiming(1, { duration: 200 }, (finished) => {
          if (finished && onAnimationFinish) {
            runOnJS(onAnimationFinish)();
          }
        }),
      ),
    );

    // Ligero "pop" o expansión al momento de estabilizarse la luz
    scale.value = withSequence(
      withDelay(500, withTiming(1.04, { duration: 200 })),
      withTiming(1, { duration: 150 }),
    );
  }, [glowOpacity, scale, onAnimationFinish]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const baseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Capa 1: Mancuerna apagada / tenue */}
      <Animated.Image
        source={require('../../assets/images/dumbbell_glow.png')}
        style={[styles.image, styles.dimmedBase, baseStyle]}
        resizeMode="contain"
      />

      {/* Capa 2: Mancuerna con luz verde neón sobrepuesta */}
      <Animated.Image
        source={require('../../assets/images/dumbbell_glow.png')}
        style={[styles.image, styles.glowLayer, animatedGlowStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    position: 'absolute',
  },
  dimmedBase: {
    opacity: 0.12, // Silueta tenue de fondo antes de encender
  },
  glowLayer: {
    // Sombra exterior para simular la dispersión del LED verde
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
  },
});
