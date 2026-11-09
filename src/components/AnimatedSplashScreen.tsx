import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const ICON_SIZE = width * 0.65; // Tamaño claro y centrado

export interface AnimatedSplashScreenProps {
  onAnimationFinish?: () => void;
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  // El ancho visible de la imagen encendida (de 0 a ICON_SIZE)
  const revealWidth = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Barrido de encendido: va "llenando" la mancuerna con su luz original
    revealWidth.value = withDelay(
      250,
      withTiming(
        ICON_SIZE,
        {
          duration: 1100,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // Curva suave y rápida
        },
        (finished) => {
          if (finished) {
            // 2. Destello final que intensifica el verde neón al completarse
            flashOpacity.value = withTiming(
              0.8,
              { duration: 150 },
              () => {
                flashOpacity.value = withTiming(0, { duration: 250 }, () => {
                  if (onAnimationFinish) {
                    runOnJS(onAnimationFinish)();
                  }
                });
              },
            );
          }
        },
      ),
    );
  }, [flashOpacity, onAnimationFinish, revealWidth]);

  // Estilo animado que expande la ventana de recorte
  const animatedRevealStyle = useAnimatedStyle(() => ({
    width: revealWidth.value,
  }));

  const animatedFlashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {/* CAPA 1: Mancuerna apagada (silueta de fondo tenue) */}
        <Animated.Image
          source={require('../../assets/images/dumbbell_glow.png')}
          style={[styles.image, styles.dimmedBase]}
          resizeMode="contain"
        />

        {/* CAPA 2: Mancuerna original brillante siendo revelada progresivamente */}
        <Animated.View style={[styles.revealBox, animatedRevealStyle]}>
          <Animated.Image
            source={require('../../assets/images/dumbbell_glow.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>

        {/* CAPA 3: Destello de brillo LED en los bordes cuando termina de llenarse */}
        <Animated.View
          pointerEvents="none"
          style={[styles.glowOverlay, animatedFlashStyle]}
        />
      </View>
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
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  dimmedBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.1, // Silueta apagada visible antes de que pase la luz
  },
  revealBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: ICON_SIZE,
    overflow: 'hidden', // Corta la imagen exactamente al ancho de la animación
  },
  glowOverlay: {
    position: 'absolute',
    width: ICON_SIZE * 1.1,
    height: ICON_SIZE * 1.1,
    borderRadius: (ICON_SIZE * 1.1) / 2,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
});
