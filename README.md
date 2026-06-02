# SUBTERRA Torneos

SUBTERRA Torneos es la plataforma interna de SUBTERRA para organizar, operar y promocionar eventos presenciales de TCG y juegos competitivos. Centraliza la preparacion del torneo, la inscripcion por QR, las rondas, los resultados, las pantallas publicas, el ranking local y el flujo de decklists para que la tienda pueda llevar eventos con una experiencia clara tanto para organizadores como para jugadores.

El proyecto esta pensado para el dia a dia de SUBTERRA: administracion en pantalla grande, jugadores desde movil mediante enlace o QR, y material visual listo para apoyar la actividad de la tienda.

## Funcionalidades principales

- Creacion y configuracion de torneos para Magic, Riftbound, Pokemon, YuGiOh, Lorcana, One Piece y Ajedrez.
- Inscripcion publica mediante QR o enlace compartible.
- Registro de jugadores nuevos y habituales por juego.
- Rondas Swiss con BYE automatico y reduccion de rivales repetidos cuando es posible.
- Modalidades individuales, 2vs2 y 3vs3.
- Estructura Swiss o Swiss + Top.
- Resultados administrados desde tienda y reportes enviados por jugadores.
- Temporizadores sincronizados entre vistas.
- Pantallas publicas de emparejamientos y temporizadores.
- Clasificacion con sistemas de desempate configurables.
- Ranking local por temporada para seguimiento competitivo de SUBTERRA.
- Panel de snapshots para recuperar estados importantes.
- Portal de jugador con mesa, rival, historial y envio de decklist.
- Deckbuilder con importacion flexible, validacion basica y exportacion visual.
- Exportacion de standings, rondas y decklists como imagen.
- Persistencia en Firebase Firestore.
- Despliegue en Firebase Hosting.

## Stack tecnico

- React 19
- TypeScript
- Vite
- Zustand
- Firebase Auth
- Firebase Firestore
- Firebase Hosting
- qrcode.react
- html2canvas
- Capacitor Android

## Requisitos

- Node.js 22 recomendado.
- npm.
- Proyecto Firebase configurado.
- Usuario administrador en Firebase Auth.
- Acceso al repositorio de GitHub para despliegues automaticos.

## Instalacion local

```bash
npm install
npm run dev
```

La aplicacion suele levantarse en:

```txt
http://localhost:5173
```

En Windows, si PowerShell bloquea scripts, usa:

```bash
npm.cmd run dev
```

## Scripts disponibles

```bash
npm run dev           # servidor local de Vite
npm run build         # comprobacion TypeScript y build de produccion
npm run lint          # ESLint
npm run preview       # previsualizar dist/
npm run publish:main  # fusiona dev en main y sube main a origin
```

## Variables de entorno

Crea un archivo `.env.local` en la raiz:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_ADMIN_AUTH_EMAIL=admin@subterra-torneos.local
VITE_PUBLIC_APP_URL=https://subterratorneo.es
```

`VITE_ADMIN_AUTH_EMAIL` debe coincidir con el usuario administrador creado en Firebase Auth.

## Firebase

El proyecto utiliza Firebase para autenticacion, persistencia y hosting.

Servicios necesarios:

- Firestore Database.
- Authentication.
- Anonymous Auth para jugadores.
- Email/Password Auth para administracion.
- Firebase Hosting.

Publicar reglas de Firestore:

```bash
npx firebase-tools@latest deploy --only firestore:rules --project subterra-torneos
```

Despliegue manual de Hosting:

```bash
npm run build
npx firebase-tools@latest deploy --only hosting --project subterra-torneos
```

## Despliegue automatico

El repositorio incluye un workflow de GitHub Actions en:

```txt
.github/workflows/firebase-hosting-main.yml
```

El workflow se ejecuta al hacer push a `main`:

1. Instala dependencias con `npm ci`.
2. Ejecuta `npm run build`.
3. Publica `dist/` en Firebase Hosting.

Para que funcione, GitHub debe tener configurado este secret:

```txt
FIREBASE_SERVICE_ACCOUNT_SUBTERRA_TORNEOS
```

El valor debe ser el JSON completo de una cuenta de servicio con permisos para desplegar en Firebase Hosting.

## Flujo de ramas

La rama de trabajo es `dev`. La rama publica es `main`.

Flujo recomendado:

```bash
git checkout dev
# desarrollar, probar y commitear
git push origin dev
```

Cuando la version este lista para publicar:

```bash
npm run publish:main
```

Ese comando:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git merge dev
git push origin main
```

Al subir `main`, GitHub Actions despliega automaticamente en Firebase Hosting.

## Flujo operativo en tienda

1. El administrador inicia sesion.
2. Se crea un torneo y se configura juego, estructura, modalidad, duracion y desempates.
3. Se comparte el QR de participacion.
4. Los jugadores se inscriben desde el movil.
5. La tienda revisa participantes y comienza la ronda 1.
6. Se gestionan emparejamientos, resultados y temporizadores.
7. Los jugadores pueden reportar resultados desde su portal.
8. La tienda valida los resultados y avanza rondas.
9. Al finalizar, se publican clasificacion, ranking local y decklists.
10. Se exportan imagenes para comunicacion y redes de SUBTERRA.

## Estructura del proyecto

```txt
src/
  App.tsx                         Shell, rutas, login admin y vistas principales
  components/
    DeckBuilderView.tsx           Constructor visual y exportador de decklists
    LocalRanking.tsx              Ranking local por temporadas
    MatchCard.tsx                 Tarjeta de mesa y resultado
    ProjectorView.tsx             Pantalla publica de emparejamientos
    RegistrationView.tsx          Inscripcion y portal del jugador
    RoundExport.tsx               Plantillas ocultas para exportacion de imagen
    SnapshotPanel.tsx             Panel de snapshots
    Timer.tsx                     Temporizador de torneo
    TimersView.tsx                Pantalla publica de temporizadores
  hooks/
    useExportImage.ts             Exportacion PNG desde DOM
    useFirebaseSync.ts            Sincronizacion con Firestore
    useSwissPairings.ts           Datos derivados de rondas y clasificacion
  services/
    cardSearch.ts                 Busqueda de cartas e imagenes
    firebase.ts                   Firebase Auth, Firestore y normalizacion remota
  store/
    timerStore.ts                 Estado de temporizadores
    tournamentsStore.ts           Estado y mutaciones de torneos
  types/
    tournament.ts                 Tipos centrales del dominio
  utils/
    deckImport.ts                 Parser de decklists
    deckRules.ts                  Reglas por juego
    tiebreakers.ts                Sistemas de desempate
    timerSound.ts                 Audio del temporizador
```

## Decklists y deckbuilder

El deckbuilder esta integrado con los torneos de SUBTERRA y usa el juego seleccionado para interpretar listas y aplicar reglas basicas.

Juegos soportados:

- Magic.
- YuGiOh.
- Pokemon.
- Lorcana.
- One Piece.
- Riftbound.

Capacidades:

- Importacion de listas en formatos habituales.
- Separacion por secciones del mazo.
- Hidratacion de imagenes cuando hay API disponible.
- Validacion basica de tamanos y copias.
- Historial de mazos por jugador.
- Exportacion de imagenes optimizadas para publicaciones.

## Desempates

Cada torneo guarda su propio sistema de desempate. La clasificacion, el podio, las exportaciones y los perfiles de mazo usan el mismo criterio configurado.

Sistemas incluidos:

- Resistencia TCG.
- Magic calculable.
- Pokemon.
- Buchholz.
- Buchholz Cut 1.
- Buchholz mediano.
- Sonneborn-Berger.
- Progresivo.
- Frente a frente.
- Criterios simples por victorias, derrotas y derrotas por tiempo.

## Seguridad

- Los jugadores acceden mediante Auth anonima.
- La administracion usa Firebase Auth con email/password.
- Las reglas de Firestore limitan acciones sensibles al usuario administrador.
- Las vistas publicas no exponen controles internos.
- Los snapshots permiten revertir estados relevantes del torneo.

## Verificacion antes de publicar

Antes de mandar `dev` a `main`:

```bash
npm run lint
npm run build
```

Si ambos comandos pasan y la version se ha revisado en local, se puede publicar con:

```bash
npm run publish:main
```

## Notas de producto

SUBTERRA Torneos no busca ser un CRM ni una herramienta generica de gestion comercial. Es una plataforma operativa para eventos de SUBTERRA: rapida de usar, clara para jugadores y preparada para convertir la actividad competitiva de la tienda en material visible, ordenado y reutilizable.
