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
import { VillagerAI, State as AIState, setGameBins } from './characters/VillagerAI.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { TaskSystem } from './systems/TaskSystem.js';
import { UIManager } from './ui/UIManager.js';
import { BUSH_DATA } from './world/Trees.js';
import { distXZ } from './utils/MathHelpers.js';
import { createLibraryLevel } from './levels/libraryLevel.js';

let engine, input, audio, collision, cam, goose, gooseCtrl;
let village, objects, interaction, taskSystem, ui;
let villagers = [];
let gameState;
let sandboxRewardsSpawned = false;
let currentLevelId = 'village';
let libraryLevel = null;

// NPC vocal pitch per type
const VOCAL_PITCH = {
  gardener: 0.85,
  shopkeeper: 1.0,
  boy: 1.4,
  oldLady: 1.15,
};

function init() {
  ui = new UIManager(startGame);
}

function startGame(levelId = 'village') {
  currentLevelId = levelId;
  const canvas = document.getElementById('game-canvas');

  // Core systems
  engine = new GameEngine(canvas);
  input = new InputManager(canvas);
  audio = new AudioManager();
  audio.init();
  audio.startAmbient();
  collision = new CollisionManager();

  // Goose
  goose = new Goose();
  engine.scene.add(goose.group);

  // Camera
  cam = new ThirdPersonCamera(engine.camera, input);
  cam.setTarget(goose.group);

  // Controller
  gooseCtrl = new GooseController(goose, input, cam, collision);

  // === Level-specific world + object + villager setup ===
  if (levelId === 'library') {
    setupLibraryLevel();
  } else {
    setupVillageLevel();
  }

  // Interaction
  interaction = new InteractionSystem(goose, objects, engine.scene, audio);
  if (levelId === 'village') {
    interaction.setProps(village.props);
    setGameBins(village.props.getBins());
  } else {
    setGameBins([]);
  }

  // Tasks
  const levelTasks = levelId === 'library' ? libraryLevel.tasks : undefined;
  const levelHorribleTasks = levelId === 'library' ? libraryLevel.horribleTasks : undefined;
  taskSystem = new TaskSystem(audio, {
    tasks: levelTasks,
    horribleTasks: levelHorribleTasks,
    levelId,
  });
  taskSystem.onTaskComplete = (task) => ui.completeTask(task);
  taskSystem.onAllComplete = () => {
    setTimeout(() => {
      ui.showVictory();
      if (levelId === 'village') spawnSandboxRewards();
    }, 1000);
  };

  // F2: Horrible mode callbacks (village only)
  taskSystem.onHorribleTaskComplete = (task) => ui.completeHorribleTask(task);
  taskSystem.onHorribleComplete = () => {
    setTimeout(() => ui.showVictory(true), 1000);
  };

  // F1: Speedrun callback
  ui.onSpeedrun = () => {
    taskSystem.startSpeedrun();
    ui.showGame(taskSystem.getTasks());
    ui.showSpeedrunTimer();
  };

  // F2: Horrible mode callback
  ui.onHorribleMode = () => {
    taskSystem.startHorribleMode();
    ui.showHorribleTasks(taskSystem.getHorribleTasks());
  };

  // Game state shared between systems
  gameState = {
    objects,
    village,
    gooseCarrying: null,
    forceDropItem: false,
    gooseHidden: false,
    gooseCrouching: false,
    wasCaught: false,
    dt: 0,
    events: {
      // Village events
      boyFellInPuddle: false,
      shopkeeperTrapped: false,
      sneakedIntoGarden: false,
      gardenerWet: false,
      shopkeeperAtPub: false,
      boyInPond: false,
      gardenerLockedOut: false,
      completedWithoutCatch: false,
      allFrustrated: false,
      // Merge per-level events
      ...(libraryLevel ? libraryLevel.initialEvents : {}),
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
    gameState.dt = dt;

    // Goose movement
    const footstep = gooseCtrl.update(dt);
    if (footstep === 'footstep' && !goose.isInWater) audio.footstep();
    goose.isInWater = village ? village.isOverWater(goose.group.position) : false;
    goose.update(dt);

    // D1: Bush hiding (village-only feature)
    if (currentLevelId === 'village') updateBushHiding();

    // D2: Crouch state
    gameState.gooseCrouching = goose.isCrouching;

    // Camera
    cam.update(dt);

    // World update
    if (village) {
      village.update(dt, elapsed);
      village.props.update(dt);
    }

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
      gameState.wasCaught = true;
    }

    // Villager AI + G1: NPC vocal reactions on state transitions
    const goosePos = goose.getPosition();
    for (const { ai } of villagers) {
      const prevState = ai.getState();
      ai.update(dt, goosePos, gameState);
      const newState = ai.getState();

      if (prevState !== newState) {
        if (newState === AIState.ALERT && prevState !== AIState.STARTLED) {
          audio.npcAlert(ai.vocalPitch);
        } else if (newState === AIState.CHASE && prevState === AIState.ALERT) {
          audio.npcChase(ai.vocalPitch);
        } else if (newState === AIState.GIVE_UP) {
          audio.npcGiveUp(ai.vocalPitch);
        }
      }
    }

    if (currentLevelId === 'village') {
      // B2: NPCs watch each other's chases
      updateNPCChaseWatching();
      // B3: Check frustration escalation
      updateFrustration();
      // Village-specific scripted events
      checkSpecialEvents(dt);
      checkNewTaskEvents(dt);
    }

    // Library-level per-frame update
    if (libraryLevel) {
      libraryLevel.update(dt, gameState, { goose, villagers, audio, cam });
    }

    // Task checking
    taskSystem.update(gameState);

    // Input actions
    if (input.justPressed('Space')) {
      // C2: Try to toggle radio first (village only)
      let handled = false;
      if (currentLevelId === 'village') {
        handled = interaction.tryToggleRadio();
      }
      if (!handled) {
        const result = interaction.tryInteract();
        // G2: Screen shake on various actions
        if (result && result.action === 'tipBin') {
          cam.shake(0.06, 0.15);
        } else if (result && result.action === 'bell') {
          cam.shake(0.03, 0.1);
        }
        // Forward interaction result to the level for custom handling
        if (libraryLevel) libraryLevel.onInteract(result, gameState);
      }
    }
    if (input.justPressed('KeyH')) {
      goose.honk();
      audio.honk();
      ui.honk();

      // D1: Honking breaks hiding
      if (goose.isHidden) {
        goose.setHidden(false);
        gameState.gooseHidden = false;
      }

      if (currentLevelId === 'village') {
        handleHonkEffects(goosePos);
      } else if (libraryLevel) {
        libraryLevel.onHonk(goosePos, gameState);
      }
    }

    if (currentLevelId === 'village') {
      handleRubberDuckHonk(goosePos);
    }

    // F1: Speedrun timer
    if (taskSystem.speedrunActive) {
      ui.updateSpeedrunTimer(taskSystem.getSpeedrunTime(), taskSystem.getPersonalBest());
    }

    if (currentLevelId === 'village') {
      updateRadioDistraction(dt);
      handleCrownPickup();
    }

    // UI
    ui.update(dt);

    // End frame
    input.endFrame();
  });

  engine.start();
}

// ===== Village-level setup =====

function setupVillageLevel() {
  village = new Village(engine.scene, collision);
  objects = new ObjectRegistry(engine.scene, collision);
  goose.group.position.set(0, 0, 0);
  setupVillagers();
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
    vocalPitch: VOCAL_PITCH.gardener,
    idleActivities: ['tend_vegetables', 'wipe_brow'],
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
    vocalPitch: VOCAL_PITCH.shopkeeper,
    idleActivities: ['sweep', 'rearrange'],
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
    vocalPitch: VOCAL_PITCH.boy,
    idleActivities: ['sit', 'kick_ground'],
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
    vocalPitch: VOCAL_PITCH.oldLady,
    idleActivities: ['read', 'feed_ducks'],
  });
  engine.scene.add(oldLady.group);
  villagers.push({ villager: oldLady, ai: oldLadyAI });

  // Pond avoidance applies to every village villager, including while chasing
  // (mirrors the former hardcoded push inside VillagerAI.moveToward).
  const pondAvoid = { x: -8, z: 10, r: 4, evenDuringChase: true };
  for (const ai of [gardenerAI, shopkeeperAI, boyAI, oldLadyAI]) {
    ai.avoidZones.push(pondAvoid);
  }
}

// ===== Library-level setup =====

function setupLibraryLevel() {
  libraryLevel = createLibraryLevel({ engine, audio, collision, goose, cam });
  objects = libraryLevel.objects;
  villagers = libraryLevel.villagers.slice();
  const start = libraryLevel.gooseStartPos;
  goose.group.position.set(start.x, start.y || 0, start.z);
  goose.group.rotation.y = 0;
  // Start the camera behind the goose so the library is in frame on arrival.
  cam.yaw = Math.PI;
  cam.pitch = 0.35;
  const cp = Math.cos(cam.pitch);
  const targetY = start.y + 1.2;
  engine.camera.position.set(
    start.x + Math.sin(cam.yaw) * cp * cam.distance,
    targetY + Math.sin(cam.pitch) * cam.distance,
    start.z + Math.cos(cam.yaw) * cp * cam.distance,
  );
  engine.camera.lookAt(start.x, targetY, start.z);
}

// D1: Bush hiding (village-only)
function updateBushHiding() {
  const goosePos = goose.getPosition();
  const isMoving = goose.isWalking;
  const isHonking = goose.isHonking;

  let inBush = false;
  if (!isMoving && !isHonking) {
    for (const bush of BUSH_DATA) {
      const dist = distXZ(goosePos, bush);
      const radius = bush.s * 0.7;
      if (dist < radius) {
        inBush = true;
        break;
      }
    }
  }

  if (inBush && !goose.isHidden) {
    goose.setHidden(true);
    gameState.gooseHidden = true;
  } else if (!inBush && goose.isHidden) {
    goose.setHidden(false);
    gameState.gooseHidden = false;
  }
}

// A1 + A2 + A3: Honk effects (village-only)
function handleHonkEffects(goosePos) {
  for (const { ai } of villagers) {
    const reaction = ai.onHonk(goosePos);
    if (reaction === 'startled') {
      audio.npcStartled(ai.vocalPitch);
      cam.shake(0.04, 0.2);
    } else if (reaction === 'chase') {
      audio.npcChase(ai.vocalPitch);
    } else if (reaction === 'investigate') {
      audio.npcAlert(ai.vocalPitch);
    }
  }

  if (village.props.marketStallPos) {
    const stallDist = distXZ(goosePos, village.props.marketStallPos);
    if (stallDist < 3) {
      village.props.scatterStallItems();
      audio.clatter();
    }
  }

  const fountainPos = { x: 0, z: -6 };
  if (distXZ(goosePos, fountainPos) < 2) {
    audio.splash();
  }
}

// B2: NPCs watch each other's chases (village-only)
function updateNPCChaseWatching() {
  const chasingNPCs = villagers.filter(v => v.ai.getState() === AIState.CHASE);
  if (chasingNPCs.length === 0) return;

  for (const { villager, ai } of villagers) {
    if (ai.getState() !== AIState.PATROL && ai.getState() !== AIState.IDLE) continue;
    const myPos = villager.getPosition();

    for (const chaser of chasingNPCs) {
      if (chaser.villager === villager) continue;
      const chaserPos = chaser.villager.getPosition();
      const dist = distXZ(myPos, chaserPos);
      if (dist < 12) {
        const dx = chaserPos.x - myPos.x;
        const dz = chaserPos.z - myPos.z;
        villager.headGroup.rotation.y = Math.atan2(dx, dz) - villager.group.rotation.y;
      }
    }
  }
}

// B3: Frustration tracking (village-only)
function updateFrustration() {
  for (const { ai } of villagers) {
    if (ai.getState() === AIState.GIVE_UP && ai.isProvoked) {
      ai.addFrustration();
      ai.isProvoked = false;
    }
  }

  const allMax = villagers.every(v => v.ai.frustration >= 3);
  if (allMax) {
    gameState.events.allFrustrated = true;
  }
}

// F3: Rubber duck honk back (village-only)
function handleRubberDuckHonk(goosePos) {
  if (!objects.rubberDuck) return;
  const duck = objects.rubberDuck;
  if (duck.isCarried && goose.isHonking) {
    audio.squeakyHonk();
  }
}

// F3: Crown equip (village-only)
function handleCrownPickup() {
  if (!objects.goldenCrown || goose.hasCrown) return;
  const crown = objects.goldenCrown;
  if (crown.isCarried) {
    goose.addCrown();
    interaction.forceDropCarried();
  }
}

// C2: Radio distraction for old lady (village-only)
function updateRadioDistraction(dt) {
  const radio = objects.getByName('radio');
  if (!radio || radio.isCarried || !radio.isPlaying) return;

  const oldLadyEntry = villagers.find(v => v.villager.type === 'oldLady');
  if (!oldLadyEntry) return;

  const radioPos = radio.getWorldPosition();
  const ladyPos = oldLadyEntry.villager.getPosition();
  const dist = distXZ(ladyPos, radioPos);

  if (dist > 2 && oldLadyEntry.ai.getState() === AIState.PATROL) {
    oldLadyEntry.ai.investigateTarget = { x: radioPos.x, z: radioPos.z };
    if (oldLadyEntry.ai.getState() !== AIState.INVESTIGATE) {
      oldLadyEntry.ai.state = AIState.INVESTIGATE;
      oldLadyEntry.ai.investigateTimer = 0;
      oldLadyEntry.ai.returnTarget = { x: ladyPos.x, z: ladyPos.z };
    }
  }

  if (dist < 3) {
    oldLadyEntry.ai.alertRadius = oldLadyEntry.ai.baseAlertRadius * 0.5;
  }
}

// F3: Spawn sandbox rewards (village-only)
function spawnSandboxRewards() {
  if (sandboxRewardsSpawned) return;
  sandboxRewardsSpawned = true;
  objects.spawnSandboxRewards();
}

function checkSpecialEvents(dt) {
  const goosePos = goose.getPosition();

  // Boy falling in puddle
  const boyEntry = villagers.find(v => v.villager.type === 'boy');
  if (boyEntry && !gameState.boyFall) {
    const boyPos = boyEntry.villager.getPosition();
    const puddlePos = { x: 8, z: 12 };
    const boyToPuddle = distXZ(boyPos, puddlePos);
    if (boyEntry.ai.getState() === AIState.CHASE && boyToPuddle < 1.2) {
      gameState.events.boyFellInPuddle = true;
      boyEntry.ai.trapped = true;
      audio.thud();
      cam.shake(0.12, 0.3);
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
      const t = Math.min(fall.timer / 0.4, 1);
      group.rotation.x = t * (Math.PI / 2);
      group.position.y = t * 0.35;
      if (t >= 1) {
        fall.phase = 'lying';
        fall.timer = 0;
      }
    } else if (fall.phase === 'lying') {
      if (fall.timer >= 2) {
        fall.phase = 'getting_up';
        fall.timer = 0;
      }
    } else if (fall.phase === 'getting_up') {
      const t = Math.min(fall.timer / 0.5, 1);
      group.rotation.x = (1 - t) * (Math.PI / 2);
      group.position.y = (1 - t) * 0.35;
      if (t >= 1) {
        group.rotation.x = 0;
        group.position.y = 0;
        boyEntry.ai.trapped = false;
        gameState.boyFall = null;

        const puddlePos = { x: 8, z: 12 };
        const boyPos = boyEntry.villager.getPosition();
        const awayX = boyPos.x - puddlePos.x;
        const awayZ = boyPos.z - puddlePos.z;
        const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ) || 1;
        boyEntry.ai.returnTarget = {
          x: puddlePos.x + (awayX / awayDist) * 4,
          z: puddlePos.z + (awayZ / awayDist) * 4,
        };
        boyEntry.ai.state = AIState.RETURN;
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
    if (dist < 1.5 && shopEntry.ai.getState() === AIState.CHASE && boothDoor && !boothDoor.isOpen) {
      gameState.events.shopkeeperTrapped = true;
      shopEntry.ai.trapped = true;
      shopEntry.villager.group.position.set(5, 0, 2);
      cam.shake(0.08, 0.2);
    }
  }

  // Sneaked into garden
  if (!gameState.events.sneakedIntoGarden) {
    const gardenCenter = { x: 12, z: -6 };
    const gooseDist = distXZ(goosePos, gardenCenter);
    if (gooseDist < 3) {
      const gardenerEntry = villagers.find(v => v.villager.type === 'gardener');
      if (gardenerEntry && gardenerEntry.ai.getState() === AIState.PATROL) {
        gameState.events.sneakedIntoGarden = true;
      }
    }
  }
}

function checkNewTaskEvents(dt) {
  const goosePos = goose.getPosition();

  if (!gameState.events.gardenerWet) {
    const wateringCan = objects.getByName('wateringCan');
    const gardenerEntry = villagers.find(v => v.villager.type === 'gardener');
    if (wateringCan && !wateringCan.isCarried && gardenerEntry) {
      const gardenerPos = gardenerEntry.villager.getPosition();
      const canPos = wateringCan.getWorldPosition();
      const dist = distXZ(gardenerPos, canPos);
      if (dist < 0.8 && gardenerEntry.ai.getState() === AIState.PATROL) {
        gameState.events.gardenerWet = true;
        audio.splash();
        cam.shake(0.08, 0.3);
        gardenerEntry.ai.trapped = true;
        setTimeout(() => {
          gardenerEntry.ai.trapped = false;
          gardenerEntry.ai.state = AIState.RETURN;
          gardenerEntry.ai.returnTarget = { x: gardenerPos.x + 2, z: gardenerPos.z };
        }, 1500);
      }
    }
  }

  if (!gameState.events.shopkeeperAtPub) {
    const shopEntry = villagers.find(v => v.villager.type === 'shopkeeper');
    if (shopEntry && shopEntry.ai.getState() === AIState.CHASE) {
      const pubPos = { x: 14, z: 10.5 };
      const shopPos = shopEntry.villager.getPosition();
      if (distXZ(shopPos, pubPos) < 5) {
        gameState.events.shopkeeperAtPub = true;
      }
    }
  }

  if (!gameState.events.boyInPond) {
    const boyEntry = villagers.find(v => v.villager.type === 'boy');
    if (boyEntry) {
      const boyPos = boyEntry.villager.getPosition();
      const pondCenter = { x: -8, z: 10 };
      if (distXZ(boyPos, pondCenter) < 4.5 && boyEntry.ai.getState() === AIState.STARTLED) {
        const kb = boyEntry.ai.startledKnockback;
        if (kb) {
          const futureX = boyPos.x + kb.x * 2;
          const futureZ = boyPos.z + kb.z * 2;
          if (distXZ({ x: futureX, z: futureZ }, pondCenter) < 3.5) {
            gameState.events.boyInPond = true;
            audio.splash();
            cam.shake(0.1, 0.3);
            boyEntry.ai.trapped = true;
            setTimeout(() => {
              boyEntry.ai.trapped = false;
              boyEntry.ai.state = AIState.RETURN;
              boyEntry.ai.returnTarget = { x: 6, z: 10 };
            }, 3000);
          }
        }
      }
    }
  }

  if (!gameState.events.gardenerLockedOut) {
    const gardenerEntry = villagers.find(v => v.villager.type === 'gardener');
    const gate1 = objects.getByName('garden1_gate');
    if (gardenerEntry && gate1) {
      const gardenerPos = gardenerEntry.villager.getPosition();
      const gardenCenter = { x: 12, z: -6 };
      const distToGarden = distXZ(gardenerPos, gardenCenter);
      if (distToGarden > 4 && !gate1.isOpen) {
        gameState.events.gardenerLockedOut = true;
      }
    }
  }

  if (!gameState.wasCaught && taskSystem.allComplete) {
    gameState.events.completedWithoutCatch = true;
  }

  if (sandboxRewardsSpawned) {
    const pubBell = objects.getByName('pubBell');
    if (pubBell && pubBell.ringing) {
      const pubPos = { x: 14, z: 10.5 };
      for (const { villager, ai } of villagers) {
        if (ai.trapped) continue;
        const myPos = villager.getPosition();
        const dx = pubPos.x - myPos.x;
        const dz = pubPos.z - myPos.z;
        villager.headGroup.rotation.y = Math.atan2(dx, dz) - villager.group.rotation.y;
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
