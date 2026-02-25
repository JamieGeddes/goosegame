# Goose Game

A 3D village mischief simulator where you play as a horrible goose. Inspired by Untitled Goose Game.

<p align="center">
  <img src="images/Goose.png" alt="A mischievous goose wearing a green bobble hat and scarf" width="280" />
</p>

## About

Control a mischievous goose and cause chaos in a small village. Complete tasks like stealing items from villagers, tricking them into embarrassing situations, and generally being a nuisance.

### Tasks

- Steal the gardener's hat
- Throw the rake in the pond
- Get the boy to fall in the puddle
- Trap the shopkeeper in the phone booth
- Steal the picnic sandwich
- Ring the pub bell
- Sneak into the garden without being caught
- Steal the old lady's glasses

## Tech Stack

- **Three.js** - 3D rendering with MeshToonMaterial for a cel-shaded cartoon look
- **Vite** - Build tool and dev server
- **Vanilla JS** - No framework dependencies
- **Web Audio API** - Procedural synthesized sound effects (honks, footsteps, bells)

All 3D models are built entirely from Three.js primitives (no external model files).

## Controls

| Key | Action |
|---|---|
| Arrow Keys / WASD | Move |
| Shift | Run |
| Space | Interact / Pick up / Drop |
| H | Honk |
| Mouse | Look around (click to capture) |

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Building

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
  main.js              Entry point
  engine/              Game engine, input, audio, collision
  camera/              Third-person camera with mouse orbit
  world/               Village environment (buildings, gardens, pond, trees, props)
  characters/          Goose model/controller, villager models/AI
  objects/             Interactable and carriable objects, gates, bell
  systems/             Interaction and task completion systems
  ui/                  Start screen, task list, HUD elements
  utils/               Materials, geometry helpers, math utilities
```
