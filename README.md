# Mi Entrenamiento

Aplicación móvil para registrar sesiones de ejercicio, series, pesos y cardio. Desarrollada con React Native, Expo SDK 57, Expo Router y almacenamiento local persistente en SQLite.

---

## 1. Qué necesitas instalar

- **Visual Studio Code**, para abrir y editar el proyecto.
- **Node.js 22.13 o posterior** (incluye `npm`). Descárgalo desde [nodejs.org](https://nodejs.org/).
- **Git**, para el control de versiones y sincronización con GitHub ([git-scm.com](https://git-scm.com/)).
- **Expo Go** en un teléfono móvil (Android o iOS) para probar la app sin emulador.
- *(Opcional)*: **Android Studio** si prefieres probar en un emulador local de Android.

> **Nota para Windows (PowerShell):** Si al ejecutar comandos obtienes un error de directiva de ejecución (`about_Execution_Policies`), ejecuta una única vez en PowerShell:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
> ```

---

## 2. Abrir el proyecto

1. En VS Code, selecciona **Archivo > Abrir carpeta** y abre la carpeta raíz del proyecto.
2. Abre la terminal integrada con **Terminal > Nueva terminal** (`Ctrl + Mayús + ñ` o ``Ctrl + Shift + ` ``).
3. Comprueba que Node.js y npm estén disponibles:
   ```powershell
   node -v
   npm -v
   git --version
   ```
   *Si la terminal dice que no reconoce los comandos tras instalar Node.js, cierra y vuelve a abrir VS Code, o refresca las variables con:*
   ```powershell
   $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
   ```

---

## 3. Instalación de dependencias

Desde la terminal integrada en la raíz del proyecto, ejecuta:

```powershell
npm install
```

Este comando descarga Expo Router, React Native, SQLite, Lucide Icons y todas las dependencias declaradas en `package.json`.

---

## 4. Diagnóstico y comprobaciones de código

Antes de iniciar la app o tras realizar cambios, puedes ejecutar las siguientes comprobaciones:

```powershell
# 1. Diagnóstico completo de dependencias y compatibilidad con Expo SDK 57
npx expo-doctor

# 2. Comprobación estricta de tipos de TypeScript
npx tsc --noEmit

# 3. Revisión de estilo y reglas de linteo (React 19 / ESLint)
npm run lint
```

---

## 5. Iniciar la aplicación

Para iniciar el servidor de desarrollo de Expo:

```powershell
npx expo start
```

- **En tu teléfono celular:** Abre la app **Expo Go** y escanea el código QR que se muestra en la terminal (ambos dispositivos deben estar en la misma red Wi-Fi).
- **Modo túnel (si la red Wi-Fi bloquea conexiones directas):**
  ```powershell
  npx expo start --tunnel
  ```
- **Iniciar directamente en emulador o navegador:**
  ```powershell
  npm run android   # Emulador Android
  npm run web       # Navegador web
  ```

---

## 6. Cómo funciona la persistencia y la base de datos

- **Inicialización Temprana:** La base local `gym_tracker.db` se inicializa y migra antes de ocultar el Splash Screen (`app/_layout.tsx`), evitando condiciones de carrera en la interfaz.
- **Borrador de seguridad:** Mientras entrenas, los cambios se respaldan automáticamente en segundo plano. Si sales de la app o se apaga la pantalla, tu sesión no se pierde.
- **Cálculo de semanas:** La semana del ciclo se calcula de forma automática según el estándar ISO de la fecha del entrenamiento.
- **Rendimiento:** Las listas del historial utilizan renderizado virtualizado con `FlatList` y componentes memoizados para mantener 60 FPS estables incluso con cientos de registros.

---

## Problemas frecuentes

- **`node` o `npm` no se reconoce:** Cierra y vuelve a abrir VS Code después de instalar Node.js, o actualiza la variable `$env:Path` en tu terminal actual.
- **Error de ejecución de scripts en PowerShell:** Ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force`.
- **El teléfono no se conecta al código QR:** Comprueba que el teléfono y el PC compartan la misma red Wi-Fi. Si la red tiene aislamiento de clientes (habitual en redes universitarias o públicas), utiliza el modo túnel con `npx expo start --tunnel`.
- **Desincronización de dependencias:** Ejecuta `npx expo install --fix` y luego `npx expo-doctor` para diagnosticar la configuración.