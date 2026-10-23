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

> **Agregar nuevas dependencias en el futuro:**
> Usa siempre `npx expo install <nombre-paquete>` en vez de `npm install <nombre-paquete>`. De esta forma Expo resolverá automáticamente la versión exacta compatible con el SDK 57.
> ```powershell
> npx expo install <paquete>
> ```

---

## 4. Diagnóstico y comprobaciones de código

Antes de iniciar la app o tras realizar cambios, puedes ejecutar las siguientes comprobaciones mediante los scripts de npm configurados:

```powershell
# 1. Diagnóstico completo de dependencias y compatibilidad con Expo SDK 57
npm run doctor        # o: npx expo-doctor

# 2. Comprobación estricta de tipos de TypeScript
npm run typecheck     # o: npx tsc --noEmit

# 3. Revisión de estilo y reglas de linteo (React 19 / ESLint)
npm run lint          # o: npx expo lint
```

---

## 5. Iniciar la aplicación

Para iniciar el servidor de desarrollo de Expo:

```powershell
npm start             # o: npx expo start
```

- **En tu teléfono celular:** Abre la app **Expo Go** y escanea el código QR que se muestra en la terminal (ambos dispositivos deben estar en la misma red Wi-Fi).
- **Modo túnel (si la red Wi-Fi bloquea conexiones directas o estás en red pública):**
  ```powershell
  npx expo start --tunnel
  ```
- **Limpiar caché de empaquetado (útil si hay errores o cambios no reflejados):**
  ```powershell
  npx expo start -c
  ```
- **Iniciar directamente en emulador o navegador:**
  ```powershell
  npm run android   # Emulador Android
  npm run ios       # Simulador iOS (requiere macOS)
  npm run web       # Navegador web
  ```
- **Detener el servidor:** Presiona `Ctrl + C` en la terminal.

---

## 6. Generación de APK y Compilación en la Nube (EAS Build)

El proyecto incluye configuración en `eas.json` para generar versiones ejecutables directamente en la nube sin requerir Android Studio ni Xcode instalados localmente:

```powershell
# 1. Iniciar sesión en tu cuenta de Expo
npx eas-cli@latest login

# 2. Generar archivo APK instalable para Android (Perfil preview)
npx eas-cli@latest build -p android --profile preview

# 3. Compilar versión para producción (AAB para Google Play Store)
npx eas-cli@latest build -p android --profile production

# 4. Publicar actualizaciones Over-The-Air (OTA)
npx eas-cli@latest update --branch production
```

---

## 7. Cómo funciona la persistencia y la base de datos

- **Inicialización Temprana:** La base local `gym_tracker.db` se inicializa y migra antes de ocultar el Splash Screen (`app/_layout.tsx`), evitando condiciones de carrera en la interfaz.
- **Borrador de seguridad:** Mientras entrenas, los cambios se respaldan automáticamente en segundo plano. Si sales de la app o se apaga la pantalla, tu sesión no se pierde.
- **Cálculo de semanas:** La semana del ciclo se calcula de forma automática según el estándar ISO de la fecha del entrenamiento.
- **Rendimiento:** Las listas del historial utilizan renderizado virtualizado con `FlatList` y componentes memoizados para mantener 60 FPS estables incluso con cientos de registros.

---

## Problemas frecuentes

- **`node` o `npm` no se reconoce:** Cierra y vuelve a abrir VS Code después de instalar Node.js, o actualiza la variable `$env:Path` en tu terminal actual.
- **Error de ejecución de scripts en PowerShell:** Ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force`.
- **El teléfono no se conecta al código QR:** Comprueba que el teléfono y el PC compartan la misma red Wi-Fi. Si la red tiene aislamiento de clientes (habitual en redes universitarias o públicas), utiliza el modo túnel con `npx expo start --tunnel`.
- **Puerto 8081 en uso:** Si otra aplicación o proceso ocupa el puerto, inicia en otro puerto con `npx expo start --port 8082`.
- **Caché corrupta o cambios que no se reflejan:** Inicia limpiando la caché de Metro con `npx expo start -c`.
- **Desincronización de dependencias:** Ejecuta `npx expo install --fix` y luego `npm run doctor` para diagnosticar la configuración.