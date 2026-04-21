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

let engine, input, audio, collision, cam, goose, gooseCtrl;
let village, objects, interaction, taskSystem, ui;
let villagers = [];
let gameState;
let sandboxRewardsSpawned = false;

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

  // Connect Props to InteractionSystem for bin tipping
  interaction.setProps(village.props);

  // Set game bins for VillagerAI obstacle avoidance
  setGameBins(village.props.getBins());

  // Villagers
  setupVillagers();

  // Tasks
  taskSystem = new TaskSystem(audio);
  taskSystem.onTaskComplete = (task) => ui.completeTask(task);
  taskSystem.onAllComplete = () => {
    setTimeout(() => {
      ui.showVictory();
      spawnSandboxRewards();
    }, 1000);
  };

  // F2: Horrible mode callbacks
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
      boyFellInPuddle: false,
      shopkeeperTrapped: false,
      sneakedIntoGarden: false,
      gardenerWet: false,
      shopkeeperAtPub: false,
      boyInPond: false,
      gardenerLockedOut: false,
      completedWithoutCatch: false,
      allFrustrated: false,
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
    goose.isInWater = village.isOverWater(goose.group.position);
    goose.update(dt);

    // D1: Bush hiding check
    updateBushHiding();

    // D2: Crouch state
    gameState.gooseCrouching = goose.isCrouching;

    // Camera
    cam.update(dt);

    // Village
    village.update(dt, elapsed);

    // Props animations (market stall scatter)
    village.props.update(dt);

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

      // G1: Play vocal sound on state transition
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

    // B2: NPCs watch each other's chases
    updateNPCChaseWatching();

    // B3: Check frustration escalation
    updateFrustration();

    // Check special events
    checkSpecialEvents(dt);

    // Check new task events
    checkNewTaskEvents(dt);

    // Task checking
    taskSystem.update(gameState);

    // Input actions
    if (input.justPressed('Space')) {
      // C2: Try to toggle radio first
      if (!interaction.tryToggleRadio()) {
        const result = interaction.tryInteract();
        // G2: Screen shake on various actions
        if (result && result.action === 'tipBin') {
          cam.shake(0.06, 0.15);
        } else if (result && result.action === 'bell') {
          cam.shake(0.03, 0.1);
        }
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

      // A1 + A2 + A3: Honk effects on NPCs and environment
      handleHonkEffects(goosePos);
    }

    // F3: Rubber duck honk-back
    handleRubberDuckHonk(goosePos);

    // F1: Speedrun timer
    if (taskSystem.speedrunActive) {
      ui.updateSpeedrunTimer(taskSystem.getSpeedrunTime(), taskSystem.getPersonalBest());
    }

    // C2: Radio distraction for old lady
    updateRadioDistraction(dt);

    // F3: Golden crown pickup
    handleCrownPickup();

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
}

// D1: Bush hiding
function updateBushHiding() {
  const goosePos = goose.getPosition();
  const isMoving = goose.isWalking;
  const isHonking = goose.isHonking;

  // Check if goose is inside any bush and stationary
  let inBush = false;
  if (!isMoving && !isHonking) {
    for (const bush of BUSH_DATA) {
      const dist = distXZ(goosePos, bush);
      const radius = bush.s * 0.7; // Hide radius based on bush scale
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

// A1 + A2 + A3: Honk effects
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

  // A2: Honk scatters market stall items
  if (village.props.marketStallPos) {
    const stallDist = distXZ(goosePos, village.props.marketStallPos);
    if (stallDist < 3) {
      village.props.scatterStallItems();
      audio.clatter();
    }
  }

  // A2: Honk near fountain causes splash
  const fountainPos = { x: 0, z: -6 };
  if (distXZ(goosePos, fountainPos) < 2) {
    audio.splash();
  }
}

// B2: NPCs watch each other's chases
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
        // Face toward the chase
        const dx = chaserPos.x - myPos.x;
        const dz = chaserPos.z - myPos.z;
        villager.headGroup.rotation.y = Math.atan2(dx, dz) - villager.group.rotation.y;
      }
    }
  }
}

// B3: Frustration tracking
function updateFrustration() {
  // Check if a villager's items have been stolen and goose escaped
  for (const { ai } of villagers) {
    if (ai.getState() === AIState.GIVE_UP && ai.isProvoked) {
      ai.addFrustration();
      ai.isProvoked = false;
    }
  }

  // Check if all NPCs are frustrated (for F2 task)
  const allMax = villagers.every(v => v.ai.frustration >= 3);
  if (allMax) {
    gameState.events.allFrustrated = true;
  }
}

// F3: Rubber duck honk back
function handleRubberDuckHonk(goosePos) {
  if (!objects.rubberDuck) return;
  const duck = objects.rubberDuck;
  if (duck.isCarried && goose.isHonking) {
    // Honk at the duck = squeaky honk back
    audio.squeakyHonk();
  }
}

// F3: Crown equip
function handleCrownPickup() {
  if (!objects.goldenCrown || goose.hasCrown) return;
  const crown = objects.goldenCrown;
  if (crown.isCarried) {
    // Auto-equip crown
    goose.addCrown();
    // Drop it from beak (crown goes on head instead)
    interaction.forceDropCarried();
  }
}

// C2: Radio distraction for old lady
function updateRadioDistraction(dt) {
  const radio = objects.getByName('radio');
  if (!radio || radio.isCarried || !radio.isPlaying) return;

  const oldLadyEntry = villagers.find(v => v.villager.type === 'oldLady');
  if (!oldLadyEntry) return;

  const radioPos = radio.getWorldPosition();
  const ladyPos = oldLadyEntry.villager.getPosition();
  const dist = distXZ(ladyPos, radioPos);

  // Old lady is drawn to playing radio
  if (dist > 2 && oldLadyEntry.ai.getState() === AIState.PATROL) {
    // Lure old lady toward radio
    oldLadyEntry.ai.investigateTarget = { x: radioPos.x, z: radioPos.z };
    if (oldLadyEntry.ai.getState() !== AIState.INVESTIGATE) {
      oldLadyEntry.ai.state = AIState.INVESTIGATE;
      oldLadyEntry.ai.investigateTimer = 0;
      oldLadyEntry.ai.returnTarget = { x: ladyPos.x, z: ladyPos.z };
    }
  }

  // Halve alert radius while listening
  if (dist < 3) {
    oldLadyEntry.ai.alertRadius = oldLadyEntry.ai.baseAlertRadius * 0.5;
  }
}

// F3: Spawn sandbox rewards
function spawnSandboxRewards() {
  if (sandboxRewardsSpawned) return;
  sandboxRewardsSpawned = true;
  objects.spawnSandboxRewards();
}

function checkSpecialEvents(dt) {
  const goosePos = goose.getPosition();

  // Boy falling in puddle - if boy is chasing goose and goose runs past puddle
  const boyEntry = villagers.find(v => v.villager.type === 'boy');
  if (boyEntry && !gameState.boyFall) {
    const boyPos = boyEntry.villager.getPosition();
    const puddlePos = { x: 8, z: 12 };
    const boyToPuddle = distXZ(boyPos, puddlePos);
    if (boyEntry.ai.getState() === AIState.CHASE && boyToPuddle < 1.2) {
      gameState.events.boyFellInPuddle = true;
      boyEntry.ai.trapped = true;
      audio.thud();
      cam.shake(0.12, 0.3); // G2: Screen shake
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
      cam.shake(0.08, 0.2); // G2: Screen shake
    }
  }

  // Sneaked into garden - goose is inside garden1 area and gardener is patrolling
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

  // E1: Get the gardener wet - watering can on gardener's path, gardener walks over it
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
        // Brief stumble animation
        gardenerEntry.ai.trapped = true;
        setTimeout(() => {
          gardenerEntry.ai.trapped = false;
          gardenerEntry.ai.state = AIState.RETURN;
          gardenerEntry.ai.returnTarget = { x: gardenerPos.x + 2, z: gardenerPos.z };
        }, 1500);
      }
    }
  }

  // E2: Lead shopkeeper to pub - shopkeeper chasing near pub
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

  // E4: Chase boy into pond - boy is chasing, honk-startle near pond pushes him in
  if (!gameState.events.boyInPond) {
    const boyEntry = villagers.find(v => v.villager.type === 'boy');
    if (boyEntry) {
      const boyPos = boyEntry.villager.getPosition();
      const pondCenter = { x: -8, z: 10 };
      if (distXZ(boyPos, pondCenter) < 4.5 && boyEntry.ai.getState() === AIState.STARTLED) {
        // Check if flinch knocked him toward pond
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

  // E5: Lock gardener out - gardener outside garden, gate closed
  if (!gameState.events.gardenerLockedOut) {
    const gardenerEntry = villagers.find(v => v.villager.type === 'gardener');
    const gate1 = objects.getByName('garden1_gate');
    if (gardenerEntry && gate1) {
      const gardenerPos = gardenerEntry.villager.getPosition();
      const gardenCenter = { x: 12, z: -6 };
      const distToGarden = distXZ(gardenerPos, gardenCenter);
      // Gardener is outside garden (>4 units from center) and gate is closed
      if (distToGarden > 4 && !gate1.isOpen) {
        gameState.events.gardenerLockedOut = true;
      }
    }
  }

  // F2: Track "no catch" for horrible task
  if (!gameState.wasCaught && taskSystem.allComplete) {
    gameState.events.completedWithoutCatch = true;
  }

  // F3: Pub bell makes all NPCs look toward pub after completion
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
