import { GameEngine } from './engine/GameEngine.js';
import { InputManager } from './engine/InputManager.js';
import { AudioManager } from './engine/AudioManager.js';
import { CollisionManager } from './engine/CollisionManager.js';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera.js';
import { Goose } from './characters/Goose.js';
import { GooseController } from './characters/GooseController.js';
import { Village } from './world/Village.js';
import { ObjectRegistry } from './objects/ObjectRegistry.js';
import { Villager } from './characters/Villager.js';
import { VillagerAI } from './characters/VillagerAI.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { TaskSystem } from './systems/TaskSystem.js';
import { UIManager } from './ui/UIManager.js';
import { distXZ } from './utils/MathHelpers.js';

let engine, input, audio, collision, cam, goose, gooseCtrl;
let village, objects, interaction, taskSystem, ui;
let villagers = [];
let gameState;

function init() {
  ui = new UIManager(startGame);
}

function startGame() {
  const canvas = document.getElementById('game-canvas');

  // Core systems
  engine = new GameEngine(canvas);
  input = new InputManager(canvas);
  audio = new AudioManager();
  audio.init();
  audio.startAmbient();
  collision = new CollisionManager();

  // World
  village = new Village(engine.scene, collision);

  // Goose
  goose = new Goose();
  goose.group.position.set(0, 0, 0);
  engine.scene.add(goose.group);

  // Camera
  cam = new ThirdPersonCamera(engine.camera, input);
  cam.setTarget(goose.group);

  // Controller
  gooseCtrl = new GooseController(goose, input, cam, collision);

  // Objects
  objects = new ObjectRegistry(engine.scene, collision);

  // Interaction
  interaction = new InteractionSystem(goose, objects, engine.scene, audio);

  // Villagers
  setupVillagers();

  // Tasks
  taskSystem = new TaskSystem(audio);
  taskSystem.onTaskComplete = (task) => ui.completeTask(task);
  taskSystem.onAllComplete = () => {
    setTimeout(() => ui.showVictory(), 1000);
  };

  // Game state shared between systems
  gameState = {
    objects,
    village,
    gooseCarrying: null,
    forceDropItem: false,
    events: {
      boyFellInPuddle: false,
      shopkeeperTrapped: false,
      sneakedIntoGarden: false,
    },
  };

  // Show UI
  ui.showGame(taskSystem.getTasks());

  // Lock pointer on canvas click
  canvas.addEventListener('click', () => {
    if (!document.pointerLockElement) {
      canvas.requestPointerLock();
    }
  });

  // Game loop
  engine.onUpdate((dt, elapsed) => {
    // Goose movement
    const footstep = gooseCtrl.update(dt);
    if (footstep === 'footstep' && !goose.isInWater) audio.footstep();
    goose.isInWater = village.isOverWater(goose.group.position);
    goose.update(dt);

    // Camera
    cam.update(dt);

    // Village
    village.update(dt, elapsed);

    // Objects
    objects.update(dt);

    // Interaction system
    interaction.update(dt);

    // Update game state
    gameState.gooseCarrying = interaction.getCarryingName();

    // Handle force drop from villager catching goose
    if (gameState.forceDropItem) {
      interaction.forceDropCarried();
      gameState.forceDropItem = false;
    }

    // Villager AI
    const goosePos = goose.getPosition();
    for (const { ai } of villagers) {
      ai.update(dt, goosePos, gameState);
    }

    // Check special events
    checkSpecialEvents(dt);

    // Task checking
    taskSystem.update(gameState);

    // Input actions
    if (input.justPressed('Space')) {
      interaction.tryInteract();
    }
    if (input.justPressed('KeyH')) {
      goose.honk();
      audio.honk();
      ui.honk();
    }

    // UI
    ui.update(dt);

    // End frame
    input.endFrame();
  });

  engine.start();
}

function setupVillagers() {
  // Gardener - patrols near garden
  const gardener = new Villager('gardener', { x: 10, z: -4 });
  const gardenerAI = new VillagerAI(gardener, [
    { x: 10, z: -4 },
    { x: 14, z: -4 },
    { x: 14, z: -8 },
    { x: 10, z: -8 },
  ], {
    alertRadius: 5,
    chaseRadius: 3.5,
    watchedItems: ['gardenerHat', 'rake', 'wateringCan', 'pumpkin'],
  });
  engine.scene.add(gardener.group);
  villagers.push({ villager: gardener, ai: gardenerAI });

  // Shopkeeper - near shop
  const shopkeeper = new Villager('shopkeeper', { x: -15, z: 3 });
  const shopkeeperAI = new VillagerAI(shopkeeper, [
    { x: -15, z: 3 },
    { x: -13, z: 3 },
    { x: -13, z: 7 },
    { x: -15, z: 7 },
  ], {
    alertRadius: 5,
    chaseRadius: 4,
    chaseSpeed: 3.5,
    watchedItems: ['apple', 'key'],
  });
  engine.scene.add(shopkeeper.group);
  villagers.push({ villager: shopkeeper, ai: shopkeeperAI });

  // Boy - near puddle area
  const boy = new Villager('boy', { x: 6, z: 10 });
  const boyAI = new VillagerAI(boy, [
    { x: 6, z: 10 },
    { x: 10, z: 10 },
    { x: 10, z: 14 },
    { x: 6, z: 14 },
  ], {
    alertRadius: 4,
    chaseRadius: 3,
    chaseSpeed: 3.8,
    watchedItems: ['sandwich'],
  });
  engine.scene.add(boy.group);
  villagers.push({ villager: boy, ai: boyAI });

  // Old Lady - near pond
  const oldLady = new Villager('oldLady', { x: -5, z: 16 });
  const oldLadyAI = new VillagerAI(oldLady, [
    { x: -5, z: 16 },
    { x: -3, z: 14 },
    { x: -7, z: 14 },
    { x: -5, z: 16 },
  ], {
    alertRadius: 4,
    chaseRadius: 3,
    chaseSpeed: 2.5,
    giveUpRadius: 8,
    watchedItems: ['glasses', 'radio'],
  });
  engine.scene.add(oldLady.group);
  villagers.push({ villager: oldLady, ai: oldLadyAI });
}

function checkSpecialEvents(dt) {
  const goosePos = goose.getPosition();

  // Boy falling in puddle - if boy is chasing goose and goose runs past puddle
  const boyEntry = villagers.find(v => v.villager.type === 'boy');
  if (boyEntry && !gameState.boyFall) {
    const boyPos = boyEntry.villager.getPosition();
    const puddlePos = { x: 8, z: 12 };
    const boyToPuddle = distXZ(boyPos, puddlePos);
    if (boyEntry.ai.getState() === 'chase' && boyToPuddle < 1.2) {
      gameState.events.boyFellInPuddle = true;
      boyEntry.ai.trapped = true;
      audio.thud();
      // Face the puddle center so the boy falls toward it
      const dx = puddlePos.x - boyPos.x;
      const dz = puddlePos.z - boyPos.z;
      boyEntry.villager.group.rotation.y = Math.atan2(dx, dz);
      gameState.boyFall = { phase: 'falling', timer: 0 };
    }
  }

  // Animate boy fall sequence
  if (gameState.boyFall) {
    const fall = gameState.boyFall;
    const group = boyEntry.villager.group;
    fall.timer += dt;

    if (fall.phase === 'falling') {
      // Tip forward over 0.4s
      const t = Math.min(fall.timer / 0.4, 1);
      group.rotation.x = t * (Math.PI / 2);
      group.position.y = t * 0.35;
      if (t >= 1) {
        fall.phase = 'lying';
        fall.timer = 0;
      }
    } else if (fall.phase === 'lying') {
      // Stay on the ground for 2s
      if (fall.timer >= 2) {
        fall.phase = 'getting_up';
        fall.timer = 0;
      }
    } else if (fall.phase === 'getting_up') {
      // Rotate back upright over 0.5s
      const t = Math.min(fall.timer / 0.5, 1);
      group.rotation.x = (1 - t) * (Math.PI / 2);
      group.position.y = (1 - t) * 0.35;
      if (t >= 1) {
        group.rotation.x = 0;
        group.position.y = 0;
        boyEntry.ai.trapped = false;
        gameState.boyFall = null;

        // Walk away from the puddle and avoid it in the future
        const puddlePos = { x: 8, z: 12 };
        const boyPos = boyEntry.villager.getPosition();
        const awayX = boyPos.x - puddlePos.x;
        const awayZ = boyPos.z - puddlePos.z;
        const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ) || 1;
        boyEntry.ai.returnTarget = {
          x: puddlePos.x + (awayX / awayDist) * 4,
          z: puddlePos.z + (awayZ / awayDist) * 4,
        };
        boyEntry.ai.state = 'return';
        if (!boyEntry.ai.avoidZones.some(z => z.x === 8 && z.z === 12)) {
          boyEntry.ai.avoidZones.push({ x: 8, z: 12, r: 1.5 });
        }
      }
    }
  }

  // Shopkeeper trapped in phone booth
  const shopEntry = villagers.find(v => v.villager.type === 'shopkeeper');
  if (shopEntry && !gameState.events.shopkeeperTrapped) {
    const shopPos = shopEntry.villager.getPosition();
    const boothPos = { x: 5, z: 2 };
    const dist = distXZ(shopPos, boothPos);
    const boothDoor = objects.getByName('phoneBoothDoor');
    if (dist < 1.5 && shopEntry.ai.getState() === 'chase' && boothDoor && !boothDoor.isOpen) {
      gameState.events.shopkeeperTrapped = true;
      shopEntry.ai.trapped = true;
      shopEntry.villager.group.position.set(5, 0, 2);
    }
  }

  // Sneaked into garden - goose is inside garden1 area and gardener is patrolling
  if (!gameState.events.sneakedIntoGarden) {
    const gardenCenter = { x: 12, z: -6 };
    const gooseDist = distXZ(goosePos, gardenCenter);
    if (gooseDist < 3) {
      const gardenerEntry = villagers.find(v => v.villager.type === 'gardener');
      if (gardenerEntry && gardenerEntry.ai.getState() === 'patrol') {
        gameState.events.sneakedIntoGarden = true;
      }
    }
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
