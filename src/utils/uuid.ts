/**
 * Generador de UUID v4 universal y seguro (RFC4122).
 * Funciona de forma 100% autónoma en React Native, Android APK, Expo Go, Web y Node
 * sin depender de módulos nativos compilados que provoquen fallos de vinculación.
 */
export function randomUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Continuar con fallback RFC4122 si el entorno no tiene crypto.randomUUID
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const Crypto = {
  randomUUID,
};

export default Crypto;
