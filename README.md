# Maple Heights

A small open-world RPG in the browser. You play as one of three cats: Toro (ginger), Uni (brown tabby) or Phantom (calico tabby), in third person with a GTA-style chase camera, and the game renders at low resolution for a chunky retro look. The world is a procedurally generated neighborhood of about 2 square miles (2.28 km × 2.28 km). It has a downtown core, a commercial ring, suburbs, parks and an industrial corner.

Built with [three.js](https://threejs.org) and [Vite](https://vitejs.dev). There are no asset files: the geometry, textures and sounds are all generated in code.

## Play it

Play in your browser at **https://ivanyu138.github.io/ivan-main/** (needs a keyboard). Every push to `master` rebuilds and republishes it.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

## Controls

| Key | On foot | In a car |
| --- | --- | --- |
| WASD | move | throttle / brake / steer |
| Mouse (or arrow keys) | orbit camera | orbit camera (auto-recenters) |
| Shift | sprint | |
| Space | jump | handbrake |
| Click / J | paw swipe | |
| E | talk / interact / enter shop | exit |
| F | enter or carjack a car | exit |
| H | | horn |
| 1–5 | use hotbar item | use hotbar item |
| Tab / I / C / M | quest log / inventory / character / map | |
| P | cycle pixel size (1×–4×) | |
| Esc | pause | |

## What's in it

- **World**: a 19×19 grid of blocks with sidewalks, lane markings, street lamps, about 4,000 houses, downtown towers, shops with awnings, parks with ponds, and warehouses. There's a day/night cycle (16 real minutes per day), and windows light up at night.
- **Cats**: pick your cat on the select screen when you start a new game, or switch later with **CHANGE CAT** on the title screen. Cats sprint fast, jump high, swipe with a paw, and sit down when left idle. Yes, they can still drive.
- **Traffic**: about 45 AI cars drive in the right-hand lane, turn at intersections, and brake for you and for each other. You can steal any of them.
- **Pedestrians**: they walk the sidewalks, flee when you punch them or honk, and get knocked over if you drive into them (which costs reputation).
- **RPG systems**: XP and levels, HP and stamina, money, reputation, and four skills (Strength, Stamina, Driving, Charisma). You get skill points on level-up, and the gym also trains skills.
- **Shops**: Corner Mart, Lou's Diner and Tony's Pizza sell consumables. St. Mercy Clinic heals you. Iron Gym trains skills. Vic's Garage repairs cars and sells them; you can buy your own sports car for $1500.
- **Quests** (look for `!` above NPCs and on the minimap):
  - *Welcome to Maple Heights* (Mayor Rosa): tour the neighborhood
  - *Where Is Whiskers?* (Mrs. Hendricks): search backyards for a lost cat
  - *Pizza Rush* (Tony): timed deliveries, repeatable
  - *Street Race* (Vic, level 2): checkpoint race, repeatable
  - *Neighborhood Watch* (Officer Daniels, level 3): fight off vandals in the park
  - *The Golden Gnomes* (Old Pete): find 10 hidden collectibles
- **Saving**: the game autosaves to `localStorage` every 20 seconds, on quest progress, and when you pause.

## Code layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Game class: loop, input routing, interactions, shops, save/load, death |
| `src/world.js` | City generation, merged and chunked geometry, colliders, minimap image |
| `src/geo.js` | `MeshBuilder` for merged vertex-colored geometry, window and sign textures |
| `src/collision.js` | Spatial hash of box and circle obstacles |
| `src/player.js`, `src/camera.js` | Character controller, chase camera |
| `src/vehicles.js` | Car models, arcade driving physics, traffic AI |
| `src/peds.js`, `src/npcs.js` | Ambient pedestrians, quest givers, enemies |
| `src/cat.js`, `src/select.js` | The three playable cats, cat-select screen |
| `src/characters.js` | Blocky humanoid model and animation (NPCs) |
| `src/rpg.js`, `src/quests.js` | Stats, items, shops, quest definitions and state machine |
| `src/ui.js` | HUD, minimap, dialog, panels |
| `src/sky.js`, `src/audio.js` | Day/night lighting, synthesized sound effects |

To add a quest, add an entry to `QUESTS` in `src/quests.js`. The stage types are `goto`, `talk`, `route` (timed checkpoints), `find`, `defeat` and `collect`. To add a quest giver, add an entry to `NPC_DEFS` in `src/npcs.js`.
