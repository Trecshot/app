import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import RawMaskedView from '@react-native-masked-view/masked-view';
import type { MaskedViewProps } from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const MaskedView = RawMaskedView as unknown as React.ComponentType<MaskedViewProps>;

const { width } = Dimensions.get('window');
const ICON_SIZE = width * 0.58;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export interface AnimatedSplashScreenProps {
  onAnimationFinish?: () => void;
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  // Posición del barrido de luz (de -ICON_SIZE a +ICON_SIZE)
  const sweepProgress = useSharedValue(-ICON_SIZE * 1.5);
  const glowBurst = useSharedValue(0.7);

  useEffect(() => {
    // 1. Barrido continuo que va encendiendo la mancuerna
    sweepProgress.value = withDelay(
      200,
      withTiming(
        ICON_SIZE * 1.5,
        {
          duration: 1200,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        (finished) => {
          if (finished) {
            // Destello final de confirmación cuando queda encendida por completo
            glowBurst.value = withTiming(1, { duration: 250 }, () => {
              if (onAnimationFinish) {
                runOnJS(onAnimationFinish)();
              }
            });
          }
        },
      ),
    );
  }, [glowBurst, onAnimationFinish, sweepProgress]);

  // Estilo animado para mover el degradado de luz
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepProgress.value }],
  }));

  const containerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowBurst.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrapper, containerGlowStyle]}>
        {/* Capa 1: Mancuerna apagada (silueta oscura fija de fondo) */}
        <Animated.Image
          source={require('../../assets/images/dumbbell_glow.png')}
          style={[styles.image, styles.dimmedBase]}
          resizeMode="contain"
        />

        {/* Capa 2: Efecto de barrido que va encendiendo la imagen brillante */}
        <MaskedView
          style={styles.maskContainer}
          maskElement={
            <Animated.Image
              source={require('../../assets/images/dumbbell_glow.png')}
              style={styles.image}
              resizeMode="contain"
            />
          }
        >
          {/* Luz LED / Neón que cruza la mancuerna y la rellena de color */}
          <AnimatedLinearGradient
            colors={[
              'rgba(74, 222, 128, 0)', // Transparente adelante
              'rgba(74, 222, 128, 0.4)', // Halo de avance
              '#39FF14', // Núcleo verde neón encendido
              '#39FF14', // Mantiene el color lleno hacia atrás
            ]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sweepGradient, sweepStyle]}
          />
        </MaskedView>
      </Animated.View>
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
  iconWrapper: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  dimmedBase: {
    position: 'absolute',
    opacity: 0.15, // Se ve la forma pero sin luz
    tintColor: '#225522', // Opcional: le da un tono apagado/metálico antes de prender
  },
  maskContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  sweepGradient: {
    width: ICON_SIZE * 3,
    height: ICON_SIZE * 3,
    position: 'absolute',
    top: -ICON_SIZE,
    left: -ICON_SIZE,
  },
});
