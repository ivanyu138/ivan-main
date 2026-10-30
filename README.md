# Maple Heights

A small open-world RPG in the browser. You play as one of three cats in third person, with a GTA-style chase camera, and the game renders at low resolution for a chunky retro look. The cats are Toro (a golden shaded British Shorthair), Uni (a brown tabby with a white belly) and Phantom (a mixed-color tabby with a two-tone face). The world is a procedurally generated, Brooklyn-style neighborhood of about 2 square miles (2.28 km × 2.28 km).

The cats, people and cars are smooth, rounded models; coat patterns like stripes and patches are painted onto them. Press **P** for a chunkier, pixelated look.

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
| Mouse, arrow keys or two-finger trackpad drag | orbit camera | orbit camera (auto-recenters) |
| Pinch (trackpad) | zoom camera | zoom camera |
| Shift | sprint | |
| Space | jump | handbrake |
| R or click | scratch | |
| E | hiss | |
| Q | meow | meow |
| T | talk / interact / enter shop / give item | |
| G | pick up / drop an item in your mouth | |
| F | enter or carjack a car | get out |
| H | | horn |
| 1–5 | use hotbar item | use hotbar item |
| Tab / I / C / M | quest log / inventory / character / map | |
| P | cycle pixel size (1×–4×) | |
| Esc or ` | pause menu: resume, change cat, list of controls | same |

## What's in it

- **World**: a Brooklyn-style grid of long blocks (228 m × 95 m). Avenues run north–south and narrow side streets run east–west.
  - Residential streets are lined with rows of brownstones and brick rowhouses with stoops and cornices, tree-lined sidewalks, and backyards in the middle of each block. Other avenues have five- and six-story apartment buildings with fire escapes.
  - **Main Street** runs down the middle with shops and restaurants on both sides and apartments above. All the game's shops are on it.
  - There's a downtown with Borough Hall to the north, the big Maple Park with a lake and meadow, a few playgrounds, and an industrial waterfront on the East River.
  - There's a day/night cycle (16 real minutes per day), and windows light up at night.
- **Cats**: pick your cat on the select screen when you start a new game, or switch later with **CHANGE CAT** on the title screen. Cats sprint fast, jump high and sit down when left idle. Each has its own meow. **Scratch** is your attack. **Meow** makes passers-by stop and look, and sometimes earns you a tip; Whiskers answers if she's in earshot. **Hiss** puffs you up, sends pedestrians running, and knocks back and freezes nearby vandals. Cats can pick up litter they find on the ground (plastic wrap, chip bags, a fish, socks, toy mice, pizza crusts, leaves, feathers, donuts and more) and carry it around in their mouth. Bring fish to Mrs. Hendricks for cat treats, sell socks to Sock Sal on Main Street (with a bonus for every five), or carry anything back to **your stash**, a cardboard box and cat bed at the edge of the Borough Hall plaza, where your pile of treasures grows and is saved. Yes, they can still drive.
- **Strays and city animals**: stray cats (black, white, grey tabby, orange tabby, tuxedo), dogs, flocks of pigeons and rats wander the sidewalks, plazas and parks. **Hiss** at people or animals and each one has a 50/50 chance of running off or turning on you. Pigeons scatter if you rush at them. Only another cat can hurt you: each stray-cat attack costs exactly 1 HP. Dogs, rats, pigeons and people chase and swat at you but do no damage. Hissing again (or scratching) at an attacker has a 50% chance to scare it off; attackers also give up if you outrun them or after a while.
- **Traffic**: about 45 AI cars drive in the right-hand lane, turn at intersections, and brake for you and for each other. You can steal any of them.
- **Pedestrians**: they walk the sidewalks, flee when you punch them or honk, and get knocked over if you drive into them (which costs reputation).
- **RPG systems**: XP and levels, HP and stamina, money, reputation, and four skills (Strength, Stamina, Driving, Charisma). You get skill points on level-up, and the gym also trains skills.
- **Shops** (all on Main Street): the Corner Bodega, Lou's Diner and Tony's Pizza sell consumables. St. Mercy Clinic heals you. Iron Gym trains skills. Vic's Garage repairs cars and sells them; you can buy your own sports car for $1500.
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
| `src/smooth.js` | `SmoothBuilder` for rounded, painted character and car models |
| `src/collision.js` | Spatial hash of box and circle obstacles |
| `src/player.js`, `src/camera.js` | Character controller, chase camera |
| `src/vehicles.js` | Car models, arcade driving physics, traffic AI |
| `src/peds.js`, `src/npcs.js` | Ambient pedestrians, quest givers, enemies |
| `src/animals.js` | Stray cats, dogs, pigeons and rats |
| `src/litter.js`, `src/stash.js` | Carryable items and the stash |
| `src/cat.js`, `src/select.js` | The three playable cats, cat-select screen |
| `src/characters.js` | Humanoid model and animation (NPCs) |
| `src/rpg.js`, `src/quests.js` | Stats, items, shops, quest definitions and state machine |
| `src/ui.js` | HUD, minimap, dialog, panels |
| `src/sky.js`, `src/audio.js` | Day/night lighting, synthesized sound effects |

To add a quest, add an entry to `QUESTS` in `src/quests.js`. The stage types are `goto`, `talk`, `route` (timed checkpoints), `find`, `defeat` and `collect`. To add a quest giver, add an entry to `NPC_DEFS` in `src/npcs.js`.
