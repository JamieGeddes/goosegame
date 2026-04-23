import { Library } from '../world/Library.js';
import { LibraryObjectRegistry } from '../objects/LibraryObjectRegistry.js';
import { Villager } from '../characters/Villager.js';
import { VillagerAI, State as AIState } from '../characters/VillagerAI.js';
import { LIBRARY_TASKS, LIBRARY_SHELF_POS } from '../systems/LibraryTaskDefinitions.js';
import { Mat } from '../utils/Materials.js';
import { distXZ } from '../utils/MathHelpers.js';

const READER_JUMPER_MATS = [Mat.shirtGreen, Mat.shirtRed, Mat.dressPurple, Mat.shirtBlue];

// Evacuation path for readers. Zig-zag shelves block direct southward routes,
// so readers head first to a shared east-of-shelves waypoint then out the door.
const FLEE_WAYPOINTS = [{ x: 8, z: -9 }, { x: 0, z: -17.5 }];
const RETURN_WAYPOINT = { x: 8, z: -9 };

export function createLibraryLevel({ engine, audio, collision, goose, cam }) {
  const world = new Library(engine.scene, collision);
  cam.setCollisionObjects(world.outerWalls);
  const objects = new LibraryObjectRegistry(engine.scene, collision, world);

  // === Librarian ===
  const librarian = new Villager('librarian', { x: world.desk.x + 1.5, z: world.desk.z });
  librarian.group.rotation.y = Math.PI; // facing south toward the door
  // Patrol threads around the zig-zag chain rather than between the shelves.
  const librarianAI = new VillagerAI(librarian, [
    { x: -5, z: -13 },                                // along desk counter
    { x: -9, z: -11 },                                // south end of west perimeter
    { x: -9, z:  5 },                                 // up the west corridor
    { x: -5, z:  6 },                                 // into children's corner
    { x:  0, z:  6 },                                 // north lane clear of all shelves
    { x:  8, z:  5 },                                 // past the tall shelf
    { x:  9, z: -3 },                                 // into bay window area
    { x:  8, z: -11 },                                // south along east side
  ], {
    alertRadius: 7,
    chaseRadius: 4,
    chaseSpeed: 4.2,
    patrolSpeed: 1.9,
    giveUpRadius: 14,
    fovAngle: Math.PI * 0.7, // ~125° cone
    losCheck: (ax, az, bx, bz) => collision.isLineOfSightBlocked(ax, az, bx, bz),
    collisionResolve: (oldP, newP, r) => collision.resolve(oldP, newP, r),
    collisionRadius: 0.4,
    // Route her back through the doorway if a chase drags her outside.
    insideCheck: (pos) => world.isInside(pos),
    entryWaypoint: { x: 0, z: -14.5 },
    watchedItems: ['stepladder', 'librarianGlasses',
      ...objects.books.map(b => b.name)],
    vocalPitch: 1.05,
    idleActivities: ['shelving_books', 'stamping', 'hushing'],
  });
  engine.scene.add(librarian.group);

  // === Readers ===
  const readers = [];
  for (let i = 0; i < world.readerSeats.length; i++) {
    const seat = world.readerSeats[i];
    const reader = new Villager('reader', { x: seat.x, z: seat.z }, {
      bodyMat: READER_JUMPER_MATS[i % READER_JUMPER_MATS.length],
    });
    // Raise slightly as if sitting on chair
    reader.group.position.y = 0.15;
    reader.group.rotation.y = seat.facing ?? Math.PI;
    const readerAI = new VillagerAI(reader, [], {
      seated: true,
      vocalPitch: 0.95 + i * 0.06,
    });
    reader.startIdleActivity('reading_book');
    engine.scene.add(reader.group);
    readers.push({ villager: reader, ai: readerAI, seatPos: { x: seat.x, z: seat.z, facing: seat.facing ?? Math.PI } });
  }

  const villagers = [
    { villager: librarian, ai: librarianAI },
    ...readers,
  ];

  // === Initial events for this level ===
  const initialEvents = {
    sneakedIn: false,
    readersDisturbed: 0,
    readerCount: readers.length,
    stepladderStolen: false,
    fireAlarmPulled: false,
    quietSignsKnocked: 0,
    quietSignCount: objects.quietSigns.length,
    bookReshelvedUpsideDown: false,
    shelvesToppled: false,
  };

  const gooseStartPos = { x: 0, y: 0, z: -22.5 };

  // === Internal state ===
  const state = {
    insideTimer: 0,
    escortCooldown: 0,
    alarmSounding: false,
    finale: {
      phase: 'idle',          // idle → waitingForTrigger → approachChair → carryChair → climbing → onChair → toppling → done
      timer: 0,
      chair: null,
      chairOriginalParent: null,
      chairOriginalPos: null,
      dominoIndex: 0,
    },
    ladder: {
      // idle → walkingToLadder → pickupLadder → carryingToShelf → placingLadder
      //      → approaching → climbing → shelving → descending
      //      → walkAwayFromLadder → returning → idle
      phase: 'idle',
      timer: 0,
      cooldown: 30,           // first ambient use 30 s after level start
      returnPoint: null,
      interrupt: false,       // set true by onHonk to abort the sequence early
      stationIdx: 0,          // index in LADDER_STATIONS where the ladder sits now
      lastStationIdx: -1,     // previous session's target, so we pick a different one
      carrying: false,        // ladder mesh is parented to librarian.group
    },
  };

  // Tip a single shelf and schedule the next one via the onHalfway callback.
  function tipShelf(idx) {
    const shelves = world.bookshelves;
    if (idx >= shelves.length) {
      // Cascade done
      state.finale.phase = 'done';
      // Trapping the librarian under books — set her trapped for cleanup
      librarianAI.trapped = true;
      librarian.setBubble('giveUp');
      return;
    }
    const shelf = shelves[idx];
    shelf.tip(1, () => tipShelf(idx + 1));
    audio.bookshelfCrash(1.0 - idx * 0.08);
    cam.shake(0.1 + idx * 0.02, 0.3);
    // Remove its collision box so the goose can walk over it
    collision.removeByName(shelf.name);
  }

  function startDominoFinale(gameState) {
    if (state.finale.phase === 'toppling' || state.finale.phase === 'done') return;
    state.finale.phase = 'toppling';
    state.finale.dominoIndex = 0;
    // Librarian topples backward onto the first shelf — tip her forward (scripted)
    librarianAI.trapped = true;
    // Fall animation: rotate librarian over 0.35s
    const group = librarian.group;
    group.userData.fallStart = performance.now();
    group.userData.falling = true;
    audio.ladderClatter();
    // Kick off the chain
    setTimeout(() => tipShelf(0), 300);
    // After the last shelf would fall (~ shelves*0.3s), mark event
    setTimeout(() => {
      gameState.events.shelvesToppled = true;
    }, 300 + world.bookshelves.length * 300);
  }

  return {
    levelId: 'library',
    world,
    objects,
    villagers,
    tasks: LIBRARY_TASKS,
    horribleTasks: [],
    initialEvents,
    gooseStartPos,

    // Called every frame by main loop after common systems run.
    update(dt, gameState, ctx) {
      const goosePos = goose.getPosition();

      // --- Sneak-in gate ---
      if (!gameState.events.sneakedIn) {
        if (world.isInside(goosePos)) {
          const libPos = librarian.getPosition();
          const dist = distXZ(libPos, goosePos);
          // Fresh FOV detection (uses LOS + head scan via VillagerAI)
          const inFov = dist < librarianAI.alertRadius
            && librarianAI.isInFieldOfView(libPos, goosePos);
          if (inFov && state.escortCooldown <= 0) {
            // She spots you — ESCORT-OUT
            goose.group.position.set(0, 0, -22.5);
            goose.group.rotation.y = 0;
            state.insideTimer = 0;
            state.escortCooldown = 1.0;
            audio.shhh();
            librarian.setBubble('alert');
            // Briefly face toward the entrance so it feels like she's watching the door
            librarianAI.faceTarget(libPos, { x: 0, z: -16 });
          } else {
            state.insideTimer += dt;
            if (state.insideTimer > 2.5) {
              gameState.events.sneakedIn = true;
              librarian.setBubble(null);
            }
          }
        } else {
          state.insideTimer = 0;
        }
      }
      if (state.escortCooldown > 0) state.escortCooldown -= dt;

      // --- Reader disturbance counter ---
      let disturbedCount = 0;
      for (const r of readers) {
        if (r.ai.disturbed) disturbedCount++;
      }
      gameState.events.readersDisturbed = disturbedCount;

      // --- Quiet signs counter ---
      gameState.events.quietSignsKnocked = objects.quietSigns
        .filter(s => s.knocked).length;

      // --- Fire alarm state transitions ---
      // Driven by sounding edges so readers re-panic on every re-pull and return
      // to their chairs whenever the lever silences the klaxon. Readers route
      // via an east-of-shelves corridor because the bookshelves at z∈{-8,-4,0,4}
      // span x=[-6,+6] and block a direct southward path from the reading area.
      const shouldSound = objects.fireAlarm.sounding;
      if (shouldSound && !state.alarmSounding) {
        // Rising edge
        audio.startFireAlarm();
        state.alarmSounding = true;
        cam.shake(0.04, 0.2);
        if (!gameState.events.fireAlarmPulled) {
          // First-ever pull: one-time librarian investigate + finale arming.
          gameState.events.fireAlarmPulled = true;
          librarianAI.state = AIState.INVESTIGATE;
          librarianAI.investigateTarget = { x: world.alarmPos.x, z: world.alarmPos.z };
          librarianAI.investigateTimer = 0;
          librarianAI.returnTarget = {
            x: librarian.getPosition().x,
            z: librarian.getPosition().z,
          };
          state.finale.phase = 'waitingForTrigger';
        }
        for (const r of readers) {
          r.villager.fleeing = true;
          r.villager.returning = false;
          r.villager.returnTimer = 0;
          r.villager.panic();
          r.villager.fleePhase = Math.random() * Math.PI * 2;
          r.villager.fleePathIdx = 0;
        }
      } else if (!shouldSound && state.alarmSounding) {
        // Falling edge
        audio.stopFireAlarm();
        state.alarmSounding = false;
        for (const r of readers) {
          r.villager.fleeing = false;
          r.villager.stopPanic();
          if (!r.villager.group.visible) {
            // Already exited the building — pop them back at the entrance so
            // they walk in through the door rather than teleporting to the chair.
            r.villager.group.visible = true;
            r.villager.group.position.set(0, 0, -15.5);
          }
          r.villager.group.position.y = 0;
          r.villager.returning = true;
          r.villager.returnTimer = 0;
          // If a bookshelf would occlude a straight shot to the seat, route
          // via the east corridor waypoint first; otherwise head direct.
          const p = r.villager.getPosition();
          const blocked = collision.isLineOfSightBlocked(p.x, p.z, r.seatPos.x, r.seatPos.z);
          r.villager.returnPathIdx = blocked ? 0 : 1;
        }
      }

      // --- Reader flee / return motion ---
      for (const r of readers) {
        if (r.villager.fleeing) {
          if (r.ai.seated) {
            r.ai.seated = false;
            r.villager.stopIdleActivity();
            r.villager.group.position.y = 0; // stand up
            r.villager.isWalking = true;
            r.villager.panic(); // re-assert after stopIdleActivity resets arms
          }
          if (!r.villager.group.visible) continue;
          const pos = r.villager.getPosition();
          const wp = FLEE_WAYPOINTS[r.villager.fleePathIdx || 0];
          const dx = wp.x - pos.x;
          const dz = wp.z - pos.z;
          const len = Math.hypot(dx, dz);
          // Advance to next waypoint once we're near this one.
          if (len < 0.6
              && (r.villager.fleePathIdx || 0) < FLEE_WAYPOINTS.length - 1) {
            r.villager.fleePathIdx = (r.villager.fleePathIdx || 0) + 1;
          }
          if (len > 0.2) {
            const spd = 4;
            // Perpendicular sway so they stagger toward the door instead of
            // marching in a straight line.
            r.villager.fleePhase = (r.villager.fleePhase || 0) + dt * 6;
            const px = -dz / len;
            const pz =  dx / len;
            const wob = Math.sin(r.villager.fleePhase) * 0.6;
            const nextX = pos.x + ((dx / len) * spd + px * wob) * dt;
            const nextZ = pos.z + ((dz / len) * spd + pz * wob) * dt;
            // Slide-resolve against shelves, tables, desks, walls.
            const resolved = collision.resolve(
              { x: pos.x, z: pos.z },
              { x: nextX, z: nextZ },
              0.3,
            );
            r.villager.group.position.x = resolved.x;
            r.villager.group.position.z = resolved.z;
            r.villager.group.rotation.y = Math.atan2(dx, dz);
            r.villager.isWalking = true;
            r.villager.update(dt);
          }
          if (pos.z < -16.5) {
            r.villager.group.visible = false;
            r.villager.stopPanic();
          }
        } else if (r.villager.returning) {
          r.villager.returnTimer = (r.villager.returnTimer || 0) + dt;
          const pos = r.villager.getPosition();
          const wp = (r.villager.returnPathIdx || 0) === 0
            ? RETURN_WAYPOINT
            : r.seatPos;
          const dx = wp.x - pos.x;
          const dz = wp.z - pos.z;
          const len = Math.hypot(dx, dz);
          const atWaypoint = (r.villager.returnPathIdx || 0) === 0 && len < 0.6;
          // Chairs (esp. the armchair) have collision boxes that keep the
          // reader's body centre 0.3 outside them, so exact-distance checks
          // can never succeed. Snap once we're pressed against the seat and
          // have a clear (occluder-free) line to it.
          const atSeat = (r.villager.returnPathIdx || 0) === 1
            && len < 0.9
            && !collision.isLineOfSightBlocked(pos.x, pos.z, r.seatPos.x, r.seatPos.z);
          if (atSeat || r.villager.returnTimer > 8) {
            r.villager.group.position.set(r.seatPos.x, 0.15, r.seatPos.z);
            r.villager.group.rotation.y = r.seatPos.facing;
            r.villager.isWalking = false;
            r.ai.seated = true;
            r.villager.startIdleActivity('reading_book');
            r.villager.returning = false;
          } else {
            if (atWaypoint || r.villager.returnTimer > 3) r.villager.returnPathIdx = 1;
            const spd = 1.5;
            const nextX = pos.x + (dx / len) * spd * dt;
            const nextZ = pos.z + (dz / len) * spd * dt;
            const resolved = collision.resolve(
              { x: pos.x, z: pos.z },
              { x: nextX, z: nextZ },
              0.3,
            );
            r.villager.group.position.x = resolved.x;
            r.villager.group.position.z = resolved.z;
            r.villager.group.rotation.y = Math.atan2(dx, dz);
            r.villager.isWalking = true;
            r.villager.update(dt);
          }
        }
      }

      // --- Librarian-on-chair sequence (once stepladder + alarm are both done) ---
      if (gameState.events.stepladderStolen
          && gameState.events.fireAlarmPulled
          && state.finale.phase === 'waitingForTrigger') {
        state.finale.phase = 'approachChair';
        state.finale.timer = 0;
        // Don't steal a chair from under a seated reader; first-match preserves
        // readingChairs[0] (chairS, closest to bookshelves) when it's free.
        const isOccupied = (chair) => readers.some(r =>
          r.ai.seated
          && Math.hypot(r.seatPos.x - chair.position.x, r.seatPos.z - chair.position.z) < 0.8,
        );
        state.finale.chair =
          world.readingChairs.find(c => !isOccupied(c)) ?? world.readingChairs[0];
      }
      updateFinale(dt, gameState);
      updateLadderBehavior(dt, gameState);

      // --- Librarian fall animation (scripted for domino) ---
      if (librarian.group.userData.falling) {
        const elapsed = (performance.now() - librarian.group.userData.fallStart) / 1000;
        const t = Math.min(elapsed / 0.4, 1);
        librarian.group.rotation.x = t * (Math.PI / 2 - 0.15);
        librarian.group.position.y = t * 0.25;
        if (t >= 1) librarian.group.userData.falling = false;
      }

      // --- Stepladder "stolen" event: goose picks it up while not in librarian FOV ---
      // Set in onInteract hook; nothing to do every frame.

      // --- Update library-owned animations ---
      world.update(dt, 0);
      objects.update(dt);
    },

    onHonk(goosePos, gameState) {
      // Seated readers + librarian both react via their AI
      for (const r of readers) {
        const reaction = r.ai.onHonk(goosePos);
        if (reaction === 'disturb' || reaction === 'startled') {
          audio.shhh();
        }
      }
      const libReaction = librarianAI.onHonk(goosePos);
      if (libReaction === 'startled') audio.npcStartled(librarianAI.vocalPitch);
      else if (libReaction === 'chase') audio.npcChase(librarianAI.vocalPitch);
      else if (libReaction === 'investigate') audio.npcAlert(librarianAI.vocalPitch);

      // Ladder interrupt: AI.onHonk is a no-op while trapped, so the library
      // level has to notice the close-range honk itself and tell the ladder
      // sequence to wrap up. She'll descend before the chase kicks in.
      if (state.ladder.phase !== 'idle') {
        const libPos = librarian.getPosition();
        if (distXZ(goosePos, libPos) < 8) {
          state.ladder.interrupt = true;
          audio.npcStartled(librarianAI.vocalPitch);
        }
      }

      // Trigger domino finale: librarian is on chair + goose honks nearby
      if (state.finale.phase === 'onChair') {
        const libPos = librarian.getPosition();
        if (distXZ(goosePos, libPos) < 6) {
          startDominoFinale(gameState);
        }
      }
    },

    onInteract(result, gameState) {
      if (!result) return;
      // Fire alarm: sound already started via update; just acknowledge
      if (result.action === 'interact' && result.item === 'fireAlarm') {
        // handled in update()
      }
      if (result.action === 'pickup' && result.item === 'stepladder') {
        // Check librarian's FOV at the moment of pickup
        const libPos = librarian.getPosition();
        const ladderPos = goose.getPosition();
        const dist = distXZ(libPos, ladderPos);
        const seen = dist < librarianAI.alertRadius
          && librarianAI.isInFieldOfView(libPos, ladderPos);
        if (!seen) {
          gameState.events.stepladderStolen = true;
        } else {
          // She sees the theft and chases
          librarianAI.isProvoked = true;
          librarian.setBubble('chase');
          audio.npcChase(librarianAI.vocalPitch);
        }
      }
      if (result.action === 'pickup' && result.item === 'librarianGlasses') {
        if (librarian.librarianGlasses) {
          librarian.librarianGlasses.visible = false;
        }
      }
      if (result.action === 'drop' && result.item && result.item.startsWith('libraryBook_')) {
        const book = objects.getByName(result.item);
        if (book && goose.isCrouching && !book.upsideDown) {
          // Crouch-drop a book → marks it upside-down (flip the mesh too)
          book.upsideDown = true;
          if (book.mesh) {
            book.mesh.rotation.z = Math.PI;
          }
          gameState.events.bookReshelvedUpsideDown = true;
        }
      }
      if (result.action === 'interact' && typeof result.item === 'string' && result.item.startsWith('quietSign')) {
        audio.thud();
        cam.shake(0.04, 0.12);
      }
    },

    destroy() {
      audio.stopFireAlarm();
      cam.setCollisionObjects([]);
      engine.scene.remove(world.group);
      for (const v of villagers) engine.scene.remove(v.villager.group);
      for (const o of objects.getAll()) {
        if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
      }
    },
  };

  // ===== Finale sequence helpers =====

  function updateFinale(dt, gameState) {
    const f = state.finale;
    if (f.phase === 'idle' || f.phase === 'waitingForTrigger' || f.phase === 'done' || f.phase === 'toppling') return;

    f.timer += dt;
    const libPos = librarian.getPosition();

    if (f.phase === 'approachChair') {
      // Walk to the chair
      librarianAI.trapped = true; // freeze AI state machine; we drive her directly
      const target = f.chair.position;
      const dx = target.x - libPos.x;
      const dz = (target.z + 0.3) - libPos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.6) {
        const spd = 2.2;
        librarian.group.position.x += (dx / len) * spd * dt;
        librarian.group.position.z += (dz / len) * spd * dt;
        librarian.group.rotation.y = Math.atan2(dx, dz);
        librarian.isWalking = true;
        librarian.update(dt);
      } else {
        // Pick up the chair (reparent to librarian)
        f.chairOriginalParent = f.chair.parent;
        f.chairOriginalPos = f.chair.position.clone();
        librarian.group.attach(f.chair);
        f.chair.position.set(0, 1.2, 0.3);
        f.chair.rotation.set(0, 0, 0);
        f.phase = 'carryChair';
        f.timer = 0;
        librarian.setBubble('searching');
      }
    } else if (f.phase === 'carryChair') {
      // Walk to the base of the end bookshelf (first shelf in cascade) — under the alarm wall
      const target = { x: world.bookshelves[0].x, z: world.bookshelves[0].z - 1.4 };
      const dx = target.x - libPos.x;
      const dz = target.z - libPos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.3) {
        const spd = 2;
        librarian.group.position.x += (dx / len) * spd * dt;
        librarian.group.position.z += (dz / len) * spd * dt;
        librarian.group.rotation.y = Math.atan2(dx, dz);
        librarian.isWalking = true;
        librarian.update(dt);
      } else {
        // Drop chair back on floor beneath her
        engine.scene.attach(f.chair);
        f.chair.position.set(librarian.group.position.x, 0, librarian.group.position.z);
        f.chair.rotation.set(0, 0, 0);
        f.phase = 'climbing';
        f.timer = 0;
      }
    } else if (f.phase === 'climbing') {
      // Lerp librarian up to the chair seat height
      const t = Math.min(f.timer / 0.6, 1);
      librarian.group.position.y = t * 0.5;
      librarian.isWalking = false;
      librarian.update(dt);
      if (t >= 1) {
        f.phase = 'onChair';
        f.timer = 0;
        librarian.setBubble('alert');
      }
    } else if (f.phase === 'onChair') {
      // Idle wobble, arms reaching up toward the alarm
      librarian.armL.rotation.x = -2.2;
      librarian.armR.rotation.x = -2.4 + Math.sin(f.timer * 3) * 0.2;
      librarian.group.rotation.z = Math.sin(f.timer * 1.5) * 0.04;
      // Waiting for honk from goose → startDominoFinale()
    }
  }

  // ===== Ambient "librarian uses stepladder" behavior =====
  // The librarian rotates through reachable bookshelves, picking up the
  // stepladder, carrying it to the next shelf, climbing to shelve books up
  // high, then moving on. While the sequence runs the ladder is inactive so
  // the goose can't steal it. Mirrors the finale's pattern: set
  // librarianAI.trapped = true and drive position/animation directly.

  // Each station is a spot the ladder can sit at with an approach point where
  // the librarian stands to pick it up / step onto it. facing is computed from
  // approach→mount at climb time.
  const LADDER_STATIONS = [
    // Tall shelf (8, 7.3) — climb height is larger since top shelf is ~2.16
    { approach: { x: 7,    z: 5.6  }, mount: { x: 7,    z: 6.3  }, climbY: 1.0 },
    // Tippable 0 (-5, -7), long-axis X — approach from the south face
    { approach: { x: -5,   z: -8.4 }, mount: { x: -5,   z: -7.6 }, climbY: 0.5 },
    // Tippable 1 (-2, -3), long-axis Z — approach from the east face
    { approach: { x: -0.5, z: -3   }, mount: { x: -1.3, z: -3   }, climbY: 0.5 },
    // Tippable 2 (3, -1), long-axis X — approach from the south face
    { approach: { x: 3,    z: -2.4 }, mount: { x: 3,    z: -1.6 }, climbY: 0.5 },
    // Tippable 3 (5, 3), long-axis Z — approach from the east face
    { approach: { x: 6.4,  z: 3    }, mount: { x: 5.6,  z: 3    }, climbY: 0.5 },
  ];

  function stationFacing(st) {
    return Math.atan2(st.mount.x - st.approach.x, st.mount.z - st.approach.z);
  }

  function ladderCurrentStation() {
    return LADDER_STATIONS[state.ladder.stationIdx] || LADDER_STATIONS[0];
  }

  function pickNextStation() {
    const l = state.ladder;
    if (LADDER_STATIONS.length <= 1) return l.stationIdx;
    let next;
    do {
      next = Math.floor(Math.random() * LADDER_STATIONS.length);
    } while (next === l.stationIdx);
    return next;
  }

  // Ladder mesh under her right arm, tucked upright with a slight lean.
  function attachLadderToLibrarian() {
    const mesh = objects.stepladder.mesh;
    if (mesh.parent !== librarian.group) {
      librarian.group.add(mesh);
    }
    mesh.position.set(0.45, 0.3, -0.15);
    mesh.rotation.set(-0.25, 0, 0.15);
    librarian.armR.rotation.x = -0.4;
    librarian.armR.rotation.z = -0.25;
    librarian.armL.rotation.x = -0.15;
    state.ladder.carrying = true;
  }

  function detachLadderTo(x, z) {
    const mesh = objects.stepladder.mesh;
    if (mesh.parent !== engine.scene) {
      engine.scene.add(mesh);
    }
    mesh.position.set(x, 0.3, z);
    mesh.rotation.set(0, 0, 0);
    librarian.armR.rotation.x = 0;
    librarian.armR.rotation.z = 0;
    librarian.armL.rotation.x = 0;
    state.ladder.carrying = false;
  }

  function handOffToAlert() {
    librarianAI.trapped = false;
    objects.stepladder.isActive = true;
    librarianAI.state = AIState.ALERT;
    librarianAI.alertTimer = 0;
    librarianAI.isProvoked = true;
    const gp = goose.getPosition();
    librarianAI.lastKnownGoosePos = { x: gp.x, z: gp.z };
  }

  // Walk toward (tx, tz); returns true once within stopRadius of the target.
  function walkLibrarianToward(tx, tz, dt, stopRadius = 0.4, speed = 1.9) {
    const libPos = librarian.getPosition();
    const dx = tx - libPos.x;
    const dz = tz - libPos.z;
    const len = Math.hypot(dx, dz);
    if (len <= stopRadius) {
      librarian.isWalking = false;
      return true;
    }
    const nextX = libPos.x + (dx / len) * speed * dt;
    const nextZ = libPos.z + (dz / len) * speed * dt;
    const resolved = collision.resolve(
      { x: libPos.x, z: libPos.z },
      { x: nextX, z: nextZ },
      0.4,
    );
    librarian.group.position.x = resolved.x;
    librarian.group.position.z = resolved.z;
    librarian.group.rotation.y = Math.atan2(dx, dz);
    librarian.isWalking = true;
    librarian.update(dt);
    return false;
  }

  function updateLadderBehavior(dt, gameState) {
    const l = state.ladder;
    const stepladder = objects.stepladder;

    // Ladder gone — stolen by the goose, or goose grabbed it from a shelf
    // while the librarian wasn't holding it. (Her own carry reparents the
    // mesh under librarian.group, so skip the bail in that case.)
    const stolenByGoose = stepladder
      && stepladder.isCarried
      && stepladder.mesh.parent !== librarian.group;
    if (gameState.events.stepladderStolen || !stepladder || stolenByGoose) {
      if (l.phase !== 'idle') {
        if (l.carrying) detachLadderTo(librarian.getPosition().x, librarian.getPosition().z);
        librarianAI.trapped = false;
        librarian.group.position.y = 0;
        librarian.armL.rotation.x = 0;
        librarian.armR.rotation.x = 0;
        librarian.armR.rotation.z = 0;
        librarian.setBubble(null);
        l.phase = 'idle';
        l.interrupt = false;
        l.cooldown = Infinity; // don't retry — the ladder's gone for good
      }
      return;
    }

    // Drop-in-place handler for mid-carry interruptions (honk, finale arm).
    function bailToAlert() {
      const p = librarian.getPosition();
      if (l.carrying) detachLadderTo(p.x, p.z);
      librarian.group.position.y = 0;
      librarian.armL.rotation.x = 0;
      librarian.armR.rotation.x = 0;
      librarian.armR.rotation.z = 0;
      handOffToAlert();
      l.phase = 'idle';
      l.cooldown = 15 + Math.random() * 15;
      l.interrupt = false;
    }

    const libPos = librarian.getPosition();

    if (l.phase === 'idle') {
      const finaleBlocking = state.finale.phase !== 'idle'
        && state.finale.phase !== 'waitingForTrigger';
      const aiReady = librarianAI.state === AIState.PATROL
        || librarianAI.state === AIState.IDLE;
      if (finaleBlocking || librarianAI.trapped || !aiReady) return;

      l.cooldown -= dt;
      if (l.cooldown > 0) return;

      // Kick off the sequence. Pick a new target station different from last.
      l.returnPoint = { x: libPos.x, z: libPos.z };
      l.lastStationIdx = l.stationIdx;
      l.timer = 0;
      l.interrupt = false;
      librarianAI.trapped = true;
      librarian.stopIdleActivity();
      stepladder.isActive = false;

      // If she's already standing near the ladder's approach point (e.g. it's
      // been left at the same station she's near), skip the walk-to phase.
      const cur = ladderCurrentStation();
      if (distXZ(libPos, cur.approach) < 0.8) {
        l.phase = 'pickupLadder';
      } else {
        l.phase = 'walkingToLadder';
      }
      return;
    }

    l.timer += dt;

    if (l.phase === 'walkingToLadder') {
      if (l.interrupt) { bailToAlert(); return; }
      const cur = ladderCurrentStation();
      if (walkLibrarianToward(cur.approach.x, cur.approach.z, dt)) {
        l.phase = 'pickupLadder';
        l.timer = 0;
      }
      return;
    }

    if (l.phase === 'pickupLadder') {
      if (l.interrupt) { bailToAlert(); return; }
      if (l.timer >= 0.4) {
        attachLadderToLibrarian();
        // Pick a new station to carry it to.
        l.stationIdx = pickNextStation();
        l.phase = 'carryingToShelf';
        l.timer = 0;
      } else {
        // Brief pre-pickup pose: bend forward slightly.
        librarian.armR.rotation.x = -0.6 * (l.timer / 0.4);
        librarian.armL.rotation.x = -0.4 * (l.timer / 0.4);
        librarian.isWalking = false;
        librarian.update(dt);
      }
      return;
    }

    if (l.phase === 'carryingToShelf') {
      if (l.interrupt) { bailToAlert(); return; }
      const next = LADDER_STATIONS[l.stationIdx];
      const arrived = walkLibrarianToward(next.approach.x, next.approach.z, dt);
      // update(dt) in walkLibrarianToward overwrites arm.x with the walking
      // swing; restore the carry hug pose after so the ladder looks held.
      librarian.armR.rotation.x = -0.4;
      librarian.armL.rotation.x = -0.15;
      if (arrived) {
        l.phase = 'placingLadder';
        l.timer = 0;
      }
      return;
    }

    if (l.phase === 'placingLadder') {
      if (l.interrupt) { bailToAlert(); return; }
      if (l.timer >= 0.4) {
        const next = LADDER_STATIONS[l.stationIdx];
        detachLadderTo(next.mount.x, next.mount.z);
        l.phase = 'approaching';
        l.timer = 0;
      } else {
        // Brief bend as she sets it down.
        const t = l.timer / 0.4;
        librarian.armR.rotation.x = -0.6 * (1 - t);
        librarian.armL.rotation.x = -0.4 * (1 - t);
        librarian.isWalking = false;
        librarian.update(dt);
      }
      return;
    }

    if (l.phase === 'approaching') {
      if (l.interrupt) { bailToAlert(); return; }
      const st = ladderCurrentStation();
      // Already at approach point after placing, so this phase just steps
      // onto the mount and aligns her facing toward the shelf.
      librarian.group.position.x = st.mount.x;
      librarian.group.position.z = st.mount.z;
      librarian.group.rotation.y = stationFacing(st);
      librarian.isWalking = false;
      l.phase = 'climbing';
      l.timer = 0;
      return;
    }

    if (l.phase === 'climbing') {
      if (l.interrupt) {
        l.phase = 'descending';
        l.timer = 0;
        return;
      }
      const st = ladderCurrentStation();
      const t = Math.min(l.timer / 0.7, 1);
      librarian.group.position.y = t * st.climbY;
      librarian.isWalking = false;
      librarian.update(dt);
      if (t >= 1) {
        l.phase = 'shelving';
        l.timer = 0;
      }
      return;
    }

    if (l.phase === 'shelving') {
      if (l.interrupt || l.timer > 3.5) {
        l.phase = 'descending';
        l.timer = 0;
        return;
      }
      // Inline arm pose — mirrors 'shelving_books' in Villager.animateIdleActivity
      librarian.armR.rotation.x = -1.3 + Math.sin(l.timer * 2.5) * 0.35;
      librarian.armL.rotation.x = -0.5;
      librarian.update(dt);
      return;
    }

    if (l.phase === 'descending') {
      const st = ladderCurrentStation();
      const t = Math.min(l.timer / 0.5, 1);
      librarian.group.position.y = (1 - t) * st.climbY;
      librarian.armR.rotation.x = 0;
      librarian.armL.rotation.x = 0;
      librarian.isWalking = false;
      librarian.update(dt);
      if (t >= 1) {
        librarian.group.position.y = 0;
        // Step back off the ladder so it stays at the mount point.
        librarian.group.position.x = st.approach.x;
        librarian.group.position.z = st.approach.z;
        if (l.interrupt) {
          handOffToAlert();
          l.phase = 'idle';
          l.cooldown = 15 + Math.random() * 15;
          l.interrupt = false;
        } else {
          l.phase = 'returning';
          l.timer = 0;
        }
      }
      return;
    }

    if (l.phase === 'returning') {
      if (l.interrupt) { bailToAlert(); return; }
      const target = l.returnPoint;
      if (walkLibrarianToward(target.x, target.z, dt)) {
        librarianAI.trapped = false;
        stepladder.isActive = true;
        l.phase = 'idle';
        l.cooldown = 15 + Math.random() * 15;
      }
      return;
    }
  }
}
