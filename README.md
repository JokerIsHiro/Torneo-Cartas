# Subterra Torneos

Aplicacion web para gestionar torneos presenciales de TCG en tienda: altas por QR, rondas Swiss, resultados, temporizadores sincronizados, clasificacion, proyeccion publica y constructor visual de decklists exportables como imagen.

## Funcionalidades

- Creacion de torneos para Magic, Riftbound, Pokemon, YuGiOh, Lorcana y One Piece.
- Inscripcion publica por enlace o QR.
- Gestion de rondas Swiss con BYE automatico y evitando repetir rivales cuando es posible.
- Envio de resultados desde jugador y aprobacion desde administracion.
- Temporizadores sincronizados entre pantallas.
- Pantalla de proyeccion para emparejamientos.
- Snapshots automaticos antes de cambios importantes.
- Deckbuilder visual solo al finalizar torneo.
- Importacion flexible de listas por juego.
- Exportacion de decklists como imagen para redes.
- Persistencia en Firebase Firestore con Auth anonima para jugadores y Auth email/password para administracion.

## Stack

- React 19
- TypeScript
- Vite
- Zustand
- Firebase Auth + Firestore
- html2canvas
- qrcode.react
- Capacitor Android

## Estructura Principal

```txt
src/
  App.tsx                         Rutas, login admin y shell principal
  components/
    DeckBuilderView.tsx           Constructor visual de mazos
    CircularTimer.tsx             Reloj circular reutilizable
    RegistrationView.tsx          Vista publica para jugadores
    ProjectorView.tsx             Pantalla publica de emparejamientos
    SnapshotPanel.tsx             Restauracion de copias automaticas
  hooks/
    useFirebaseSync.ts            Suscripcion a Firestore
    useSwissPairings.ts           Datos derivados de rondas/clasificacion
    useExportImage.ts             Exportacion PNG desde DOM
  services/
    firebase.ts                   Auth, Firestore y normalizacion remota
    cardSearch.ts                 APIs de cartas por juego
  store/
    tournamentsStore.ts           Estado y mutaciones de torneos
    timerStore.ts                 Estado y sync de temporizadores
  utils/
    deckImport.ts                 Parser flexible de decklists
    deckRules.ts                  Reglas y secciones por juego
    timerSound.ts                 Audio del temporizador
  types/
    tournament.ts                 Tipos centrales del dominio
```

## Instalacion

```bash
npm install
npm run dev
```

En Windows, si PowerShell bloquea scripts, usa:

```bash
npm.cmd run dev
```

La app de desarrollo suele quedar en:

```txt
http://localhost:5173
```

## Scripts

```bash
npm run dev       # servidor local de Vite
npm run build     # TypeScript + build de produccion
npm run preview   # previsualizar dist/
npm run lint      # ESLint
```

## Variables De Entorno

Crea `.env.local` en la raiz:

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

`VITE_ADMIN_AUTH_EMAIL` debe coincidir con el usuario creado en Firebase Auth y con las reglas de Firestore.

## Configuracion De Firebase

1. Crea un proyecto en Firebase.
2. Activa Firestore Database.
3. Activa Authentication.
4. Habilita `Anonymous` para jugadores.
5. Habilita `Email/Password` para administracion.
6. Crea el usuario administrador con el email configurado en `VITE_ADMIN_AUTH_EMAIL`.
7. Copia la configuracion web de Firebase a `.env.local`.
8. Publica `firestore.rules`.

Reglas:

```bash
firebase deploy --only firestore:rules
```

Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Flujo De Uso

1. Entra como administrador.
2. Crea un torneo y elige juego.
3. Comparte el QR de inscripcion.
4. Revisa jugadores y empieza el torneo.
5. Gestiona rondas, resultados y temporizadores.
6. Finaliza el torneo.
7. Abre el constructor de decks.
8. Importa o monta visualmente las listas.
9. Guarda, publica y exporta imagenes para redes.

## Importacion De Mazos

El importador usa el juego del torneo. Esto evita importar accidentalmente un mazo de Lorcana en un torneo de Magic.

Formatos aceptados:

### YuGiOh

```txt
Monster:
3x Aluber the Jester of Despia

Spell:
1x Branded Fusion

Extra:
1x Mirrorjade the Iceblade Dragon

Side:
1x Nibiru, the Primal Being
```

Tambien acepta `.ydk`:

```txt
#main
68468459
#extra
44146295
!side
27204311
```

### Magic

```txt
Deck
4 Lightning Bolt
4 Monastery Swiftspear

Sideboard
2 Negate
```

Tambien limpia set y numero:

```txt
4 Aurelia, Exemplar of Justice (GRN) 153
```

### Pokemon

```txt
Pokemon - 15
2 Chien-Pao ex PAL 61

Trainer Cards - 36
4 Ultra Ball SVI 196

Energy - 9
8 Water Energy NRG 28
```

### Lorcana

```txt
4 Elsa - Snow Queen
4 Donald Duck - Perfect Gentleman
4 Cursed Merfolk - Ursula's Handiwork
```

### One Piece

```txt
Leader:
1 OP01-001 Monkey.D.Luffy

Deck:
4 OP01-016 Nami
4 OP01-017 Nico Robin
```

El DON!! no se importa: la app lo asume como 10.

### Riftbound

```txt
Legend:
1 Jinx

Champion:
1 Jinx, Loose Cannon

Main:
3 Card Name

Runes:
6 Fury Rune
6 Chaos Rune

Battlefields:
1 Battlefield Name
```

## Reglas De Deckbuilding

Las reglas viven en `src/utils/deckRules.ts`.

- Magic: Main 60+, Sideboard 15, maximo 4 copias salvo tierras basicas.
- YuGiOh: Main 40-60, Extra 15, Side 15, maximo 3 copias.
- Pokemon: 60 exactas, maximo 4 copias salvo energias basicas.
- Lorcana: Main 60+, maximo 4 copias.
- One Piece: Leader 1, Main 50, maximo 4 copias, DON!! asumido.
- Riftbound: Legend, Champion, Main 40, Rune Deck, Battlefields y Sideboard separados.

Las banlists dinamicas no estan integradas todavia. La validacion actual avisa por estructura y copias, pero no sustituye a una revision de juez.

## APIs De Cartas

- Magic: Scryfall.
- Pokemon: Pokemon TCG API.
- YuGiOh: YGOPRODeck.
- Lorcana: Lorcast.
- One Piece y Riftbound: por ahora se prioriza importacion manual/codigos y reglas locales.

Las imagenes de YuGiOh se pasan por proxy para evitar problemas de CORS al exportar PNG.

## Seguridad

- Los jugadores usan Auth anonima.
- El administrador usa Firebase Auth email/password con email fijo.
- Firestore Rules limitan escrituras sensibles al usuario administrador.
- Las listas de mazo solo se editan al finalizar el torneo.
- Los snapshots permiten revertir cambios importantes.

## Desarrollo

Antes de cerrar una tarea:

```bash
npm.cmd run build
```

Si se toca Firebase, revisar tambien:

```bash
firestore.rules
src/services/firebase.ts
src/store/tournamentsStore.ts
```

## Roadmap Sugerido

- Resolver cartas importadas automaticamente tambien para One Piece por codigo.
- Banlists configurables por juego/formato.
- Tests unitarios para `deckImport.ts` y `deckRules.ts`.
- Code splitting del deckbuilder para reducir el aviso de chunk grande.
- Exportacion de decklists en formatos externos: `.ydk`, Arena text, PTCGL text.
- Historial visual de snapshots con comparacion de cambios.

## Notas

El proyecto esta pensado para funcionar como herramienta de tienda: pantallas grandes para administracion/proyeccion y movil para jugadores mediante QR. Mantener esa separacion evita que las vistas publicas se llenen de controles de administracion.
