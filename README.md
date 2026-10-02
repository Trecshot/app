# Mi Entrenamiento

Aplicación móvil para registrar sesiones de ejercicio, series, pesos y cardio. Los datos se guardan localmente en una base SQLite del dispositivo.

## 1. Qué necesitas instalar

- **Visual Studio Code**, para abrir y editar el proyecto.
- **Node.js 22.13 o posterior**. La descarga de Node.js también instala npm, que se usará para instalar las dependencias.
- **Expo Go** en un teléfono si quieres probar la app sin configurar un emulador.
- Opcional: **Android Studio** para usar un emulador Android. En Windows no se puede iniciar el simulador de iOS localmente.

Descarga Node.js desde [nodejs.org](https://nodejs.org/). Después de instalarlo, cierra y vuelve a abrir VS Code para que la terminal reconozca los comandos `node` y `npm`.

## 2. Abrir el proyecto

1. En VS Code, selecciona **Archivo > Abrir carpeta**.
2. Abre la carpeta raíz del proyecto, donde están `package.json` y `package-lock.json`.
3. Abre una terminal integrada con **Terminal > Nueva terminal**.
4. Comprueba que Node.js y npm estén disponibles:

	```powershell
	node -v
	npm -v
	```

	Si PowerShell dice que no reconoce esos comandos, cierra y vuelve a abrir VS Code. Si el problema continúa, revisa que Node.js se haya agregado al `PATH` de Windows.

## 3. Descargar las dependencias

Desde la terminal integrada, confirma que estás en la carpeta del proyecto y ejecuta:

```powershell
npm install
```

Este paso descarga Expo, React Native, SQLite y las demás dependencias declaradas en `package.json`. Solo es necesario repetirlo si cambian las dependencias o si se elimina la carpeta `node_modules`.

## 4. Revisar el proyecto

Antes de iniciar la aplicación, puedes ejecutar estas comprobaciones:

```powershell
npm run lint
npx tsc --noEmit
```

La primera revisa el estilo y posibles problemas de código. La segunda comprueba los tipos de TypeScript sin generar archivos. Si VS Code sigue mostrando un error anterior después de instalar dependencias, usa **Ctrl+Shift+P**, ejecuta **TypeScript: Restart TS Server** y vuelve a revisar el archivo.

## 5. Iniciar la aplicación

En la terminal de VS Code ejecuta:

```powershell
npx expo start
```

Expo mostrará un código QR y opciones para abrir la aplicación. Escanea el código con Expo Go en el teléfono; el teléfono y la computadora deben estar conectados a una red que permita comunicarse entre ellos. También puedes elegir un emulador Android si ya está instalado y configurado.

Para iniciar directamente en una plataforma, también existen estos comandos:

```powershell
npm run android
npm run web
```

## 6. Subir cambios a GitHub

Para publicar cambios necesitas tener Git instalado, abrir en VS Code una copia clonada del repositorio y haber iniciado sesión en GitHub. En la terminal, revisa primero qué archivos cambiaron:

```powershell
git status
```

Agrega solo los archivos que quieras publicar, crea un commit y envíalo a la rama `main`:

```powershell
git add App.tsx database.ts types.ts README.md
git commit -m "mostrar detalle del historial"
git push origin main
```

Si cambiaste otros archivos, agrégalos también con `git add` antes de crear el commit. No agregues `node_modules`; sus dependencias se instalan en cada computadora con `npm install`.

## 7. Cómo se guardan los entrenamientos

La base local `gym_tracker.db` se inicializa automáticamente al abrir la aplicación. Guarda las sesiones en tablas relacionadas de entrenamientos, ejercicios/series y cardio; no hace falta crear las tablas manualmente.

Si el dispositivo ya tenía sesiones guardadas en el formato anterior, la aplicación intenta importarlas automáticamente la primera vez que abre la nueva base. Los registros nuevos y los eliminados se guardan en la base local del dispositivo. Desinstalar la app o borrar sus datos puede eliminar esos registros.

## Problemas frecuentes

- **`node` o `npm` no se reconoce:** reinicia VS Code después de instalar Node.js y confirma que la carpeta de Node.js esté en el `PATH` de Windows.
- **No encuentra `expo/tsconfig.base`:** abre la terminal en la raíz del proyecto y ejecuta `npm install`; después reinicia el servidor de TypeScript.
- **El teléfono no se conecta al QR:** comprueba la red Wi-Fi y que el firewall no esté bloqueando la conexión. Si la red no permite conexiones locales, inicia Expo en modo túnel desde el menú de la terminal de Expo.
- **Cambiaste paquetes o `package-lock.json`:** ejecuta `npm install` otra vez y reinicia el servidor de Expo.