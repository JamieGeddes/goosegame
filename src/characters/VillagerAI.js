import { distXZ, angleDiff } from '../utils/MathHelpers.js';

export const State = {
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  RETURN: 'return',
  GIVE_UP: 'give_up',
  STARTLED: 'startled',
  SEARCHING: 'searching',
  INVESTIGATE: 'investigate',
  IDLE: 'idle',
};

export class VillagerAI {
  constructor(villager, waypoints, config = {}) {
    this.villager = villager;
    this.waypoints = waypoints;
    this.currentWaypoint = 0;
    this.state = State.PATROL;

    this.patrolSpeed = config.patrolSpeed || 1.5;
    this.baseChaseSpeed = config.chaseSpeed || 4;
    this.chaseSpeed = this.baseChaseSpeed;
    this.baseAlertRadius = config.alertRadius || 6;
    this.alertRadius = this.baseAlertRadius;
    this.chaseRadius = config.chaseRadius || 4;
    this.giveUpRadius = config.giveUpRadius || 12;
    this.alertTime = config.alertTime || 1.0;

    this.alertTimer = 0;
    this.giveUpTimer = 0;
    this.returnTarget = null;
    this.isProvoked = false;
    this.trapped = false;

    // Track stolen items this villager cares about
    this.watchedItems = config.watchedItems || [];

    // Zones to avoid when not chasing (same format as pond: {x, z, r})
    this.avoidZones = [];

    // D3: Field of view (120-degree cone)
    this.fovAngle = Math.PI / 3; // 60 degrees half-angle = 120 degree cone
    this.headScanTimer = 0;
    this.headScanDirection = 0; // -1, 0, 1

    // A1: Startled state
    this.startledTimer = 0;
    this.startledKnockback = null;

    // D1: Searching state
    this.searchTimer = 0;
    this.searchPhase = 0; // 0=walking to last known, 1=looking around
    this.lastKnownGoosePos = null;

    // A3: Investigate state (honk lure)
    this.investigateTarget = null;
    this.investigateTimer = 0;

    // B1: Idle activities at waypoints
    this.idleTimer = 0;
    this.idleActivity = null;
    this.idleChance = 0.5;
    this.idleActivities = config.idleActivities || [];

    // B3: Emotional memory (frustration)
    this.frustration = 0;
    this.maxFrustration = 3;
    this.fistShakeTimer = 0;

    // Pitch multiplier for NPC vocals (varies per NPC)
    this.vocalPitch = config.vocalPitch || 1.0;
  }

  update(dt, goosePos, gameState) {
    if (this.trapped) {
      this.villager.isWalking = false;
      return;
    }

    const myPos = this.villager.getPosition();
    const dist = distXZ(myPos, goosePos);

    // Update frustration effects
    this.alertRadius = this.baseAlertRadius + Math.min(this.frustration, this.maxFrustration) * 2;
    this.chaseSpeed = this.baseChaseSpeed * (1 + Math.min(this.frustration, this.maxFrustration) * 0.2 * (this.frustration >= 2 ? 1 : 0));

    switch (this.state) {
      case State.PATROL:
        this.doPatrol(dt, myPos, goosePos, dist, gameState);
        break;
      case State.IDLE:
        this.doIdle(dt, myPos, goosePos, dist, gameState);
        break;
      case State.ALERT:
        this.doAlert(dt, myPos, goosePos, dist, gameState);
        break;
      case State.CHASE:
        this.doChase(dt, myPos, goosePos, dist, gameState);
        break;
      case State.RETURN:
        this.doReturn(dt, myPos);
        break;
      case State.GIVE_UP:
        this.doGiveUp(dt, myPos);
        break;
      case State.STARTLED:
        this.doStartled(dt, myPos, goosePos);
        break;
      case State.SEARCHING:
        this.doSearching(dt, myPos);
        break;
      case State.INVESTIGATE:
        this.doInvestigate(dt, myPos);
        break;
    }

    // B3: Fist shake when frustrated level 3
    if (this.frustration >= 3 && this.state === State.PATROL) {
      this.fistShakeTimer += dt;
      if (this.fistShakeTimer > 5) {
        this.villager.fistShake();
        this.fistShakeTimer = 0;
      }
    }

    // D3: Head scanning during patrol
    if (this.state === State.PATROL || this.state === State.IDLE) {
      this.headScanTimer += dt;
      if (this.headScanTimer > 3) {
        this.headScanDirection = this.headScanDirection === 0 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        this.headScanTimer = 0;
        this.villager.setHeadScan(this.headScanDirection);
      }
    } else {
      this.headScanDirection = 0;
      this.villager.setHeadScan(0);
    }

    this.villager.update(dt);
  }

  // D3: Check if goose is within NPC's field of view
  isInFieldOfView(myPos, goosePos) {
    const facingAngle = this.villager.group.rotation.y;
    const toGooseAngle = Math.atan2(goosePos.x - myPos.x, goosePos.z - myPos.z);
    const diff = Math.abs(angleDiff(facingAngle, toGooseAngle));
    return diff < this.fovAngle;
  }

  // Combined detection check: distance + FoV + hidden
  canDetectGoose(myPos, goosePos, dist, gameState) {
    // Can always detect if goose is carrying a watched item (sense their stuff is gone)
    if (this.checkProvocation(gameState)) return true;

    // Can't detect a hidden goose unless very close
    if (gameState.gooseHidden) {
      return dist < 2;
    }

    // Crouching reduces effective alert radius
    const effectiveRadius = gameState.gooseCrouching ? this.alertRadius * 0.6 : this.alertRadius;

    // Must be within alert radius AND in field of view
    if (dist > effectiveRadius) return false;
    return this.isInFieldOfView(myPos, goosePos);
  }

  doPatrol(dt, myPos, goosePos, dist, gameState) {
    this.villager.setAlert(false);
    this.villager.setBubble(null);

    if (this.waypoints.length === 0) {
      this.villager.isWalking = false;
      return;
    }

    const target = this.waypoints[this.currentWaypoint];
    const toDist = distXZ(myPos, target);

    if (toDist < 0.5) {
      // B1: Chance to idle at waypoint
      if (this.idleActivities.length > 0 && Math.random() < this.idleChance) {
        this.state = State.IDLE;
        this.idleTimer = 0;
        this.idleActivity = this.idleActivities[Math.floor(Math.random() * this.idleActivities.length)];
        this.villager.isWalking = false;
        this.villager.startIdleActivity(this.idleActivity);
        return;
      }
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    } else {
      this.moveToward(myPos, target, this.patrolSpeed, dt);
      this.villager.isWalking = true;
    }

    // Check if goose is nearby or provoked (with FoV check)
    if (this.canDetectGoose(myPos, goosePos, dist, gameState)) {
      this.state = State.ALERT;
      this.alertTimer = 0;
      this.villager.isWalking = false;
      this.lastKnownGoosePos = { x: goosePos.x, z: goosePos.z };
    }
  }

  doIdle(dt, myPos, goosePos, dist, gameState) {
    this.villager.setAlert(false);
    this.villager.setBubble(null);
    this.villager.isWalking = false;

    this.idleTimer += dt;
    const idleDuration = 2 + Math.random() * 2;
    if (this.idleTimer > idleDuration) {
      this.villager.stopIdleActivity();
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
      this.state = State.PATROL;
      return;
    }

    // Can still detect goose while idling
    if (this.canDetectGoose(myPos, goosePos, dist, gameState)) {
      this.villager.stopIdleActivity();
      this.state = State.ALERT;
      this.alertTimer = 0;
      this.lastKnownGoosePos = { x: goosePos.x, z: goosePos.z };
    }
  }

  doAlert(dt, myPos, goosePos, dist, gameState) {
    this.villager.setAlert(true);
    this.villager.setBubble('alert');
    this.villager.isWalking = false;

    // Face the goose
    this.faceTarget(myPos, goosePos);

    this.alertTimer += dt;
    if (this.alertTimer > this.alertTime) {
      if (dist < this.chaseRadius || this.checkProvocation(gameState)) {
        this.state = State.CHASE;
        this.returnTarget = { x: myPos.x, z: myPos.z };
      } else {
        this.state = State.PATROL;
      }
    }
  }

  doChase(dt, myPos, goosePos, dist, gameState) {
    this.villager.setAlert(true);
    this.villager.setBubble('chase');
    this.villager.isWalking = true;

    // Track last known position for searching
    if (!gameState.gooseHidden) {
      this.lastKnownGoosePos = { x: goosePos.x, z: goosePos.z };
    }

    // If goose hides in bush, switch to searching
    if (gameState.gooseHidden && dist > 2) {
      this.state = State.SEARCHING;
      this.searchTimer = 0;
      this.searchPhase = 0;
      this.villager.isWalking = true;
      return;
    }

    this.moveToward(myPos, goosePos, this.chaseSpeed, dt);

    // Catch the goose
    if (dist < 1.0) {
      // Force drop carried item
      if (gameState.gooseCarrying) {
        gameState.forceDropItem = true;
      }
      this.state = State.RETURN;
      this.isProvoked = false;
    }

    // Give up if too far
    if (dist > this.giveUpRadius) {
      this.state = State.GIVE_UP;
      this.giveUpTimer = 0;
    }
  }

  doReturn(dt, myPos) {
    this.villager.setAlert(false);
    this.villager.setBubble(null);

    if (!this.returnTarget) {
      this.state = State.PATROL;
      return;
    }

    const dist = distXZ(myPos, this.returnTarget);
    if (dist < 0.5) {
      this.state = State.PATROL;
      this.returnTarget = null;
    } else {
      this.moveToward(myPos, this.returnTarget, this.patrolSpeed, dt);
      this.villager.isWalking = true;
    }
  }

  doGiveUp(dt, myPos) {
    this.villager.setAlert(false);
    this.villager.setBubble('giveUp');
    this.villager.isWalking = false;
    this.giveUpTimer += dt;

    if (this.giveUpTimer > 1.5) {
      this.state = State.RETURN;
      this.isProvoked = false;
      this.villager.setBubble(null);
    }
  }

  // A1: Startled reaction from honk
  doStartled(dt, myPos, goosePos) {
    this.villager.setAlert(true);
    this.villager.setBubble('startled');
    this.villager.isWalking = false;
    this.startledTimer += dt;

    // Small knockback
    if (this.startledKnockback && this.startledTimer < 0.2) {
      const kb = this.startledKnockback;
      myPos.x += kb.x * dt * 3;
      myPos.z += kb.z * dt * 3;
    }

    // Flinch animation for first 0.5s
    if (this.startledTimer < 0.5) {
      this.villager.setFlinch(1 - this.startledTimer / 0.5);
    } else {
      this.villager.setFlinch(0);
    }

    if (this.startledTimer > 0.5) {
      this.villager.setFlinch(0);
      // After flinch, become alert and ready to chase
      this.state = State.ALERT;
      this.alertTimer = this.alertTime * 0.5; // Already half-alerted
      this.lastKnownGoosePos = { x: goosePos.x, z: goosePos.z };
      this.faceTarget(myPos, goosePos);
    }
  }

  // D1: Searching for hidden goose
  doSearching(dt, myPos) {
    this.villager.setAlert(true);
    this.villager.setBubble('searching');
    this.searchTimer += dt;

    if (this.searchPhase === 0) {
      // Walk to last known goose position
      if (!this.lastKnownGoosePos) {
        this.state = State.GIVE_UP;
        this.giveUpTimer = 0;
        return;
      }
      const dist = distXZ(myPos, this.lastKnownGoosePos);
      if (dist < 1.0 || this.searchTimer > 3) {
        this.searchPhase = 1;
        this.searchTimer = 0;
      } else {
        this.moveToward(myPos, this.lastKnownGoosePos, this.patrolSpeed * 1.2, dt);
        this.villager.isWalking = true;
      }
    } else {
      // Look left/right for 2s
      this.villager.isWalking = false;
      const lookAngle = Math.sin(this.searchTimer * 3) * 0.8;
      this.villager.setHeadScan(lookAngle > 0 ? 1 : -1);

      if (this.searchTimer > 2) {
        this.state = State.GIVE_UP;
        this.giveUpTimer = 0;
        this.villager.setHeadScan(0);
      }
    }
  }

  // A3: Investigate a sound (honk lure)
  doInvestigate(dt, myPos) {
    this.villager.setAlert(false);
    this.villager.setBubble('searching');
    this.investigateTimer += dt;

    if (!this.investigateTarget) {
      this.state = State.PATROL;
      return;
    }

    const dist = distXZ(myPos, this.investigateTarget);
    if (dist < 1.0 || this.investigateTimer > 4) {
      // Pause, look around, then return
      this.villager.isWalking = false;
      if (this.investigateTimer > 5) {
        this.state = State.RETURN;
        this.returnTarget = this.waypoints[this.currentWaypoint];
        this.investigateTarget = null;
      }
    } else {
      this.moveToward(myPos, this.investigateTarget, this.patrolSpeed, dt);
      this.villager.isWalking = true;
    }
  }

  // A1: Called when goose honks
  onHonk(goosePos) {
    if (this.trapped) return null;
    const myPos = this.villager.getPosition();
    const dist = distXZ(myPos, goosePos);

    // A1: Startle within 8 units
    if (dist < 8) {
      const dx = myPos.x - goosePos.x;
      const dz = myPos.z - goosePos.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;

      if (this.state === State.PATROL || this.state === State.IDLE) {
        // Flinch, then become alert
        this.villager.stopIdleActivity();
        this.state = State.STARTLED;
        this.startledTimer = 0;
        this.startledKnockback = { x: dx / d, z: dz / d };
        this.faceTarget(myPos, goosePos);
        this.villager.flinch();
        return 'startled';
      } else if (this.state === State.ALERT) {
        // Immediately chase
        this.state = State.CHASE;
        this.returnTarget = { x: myPos.x, z: myPos.z };
        return 'chase';
      } else if (this.state === State.GIVE_UP || this.state === State.RETURN) {
        // Resume chasing
        this.state = State.CHASE;
        if (!this.returnTarget) {
          this.returnTarget = { x: myPos.x, z: myPos.z };
        }
        return 'chase';
      }
    }

    // A3: Lure from 6-8 unit range while patrolling
    if (dist >= 6 && dist <= 10 && this.state === State.PATROL) {
      this.state = State.INVESTIGATE;
      this.investigateTarget = { x: goosePos.x, z: goosePos.z };
      this.investigateTimer = 0;
      this.returnTarget = { x: myPos.x, z: myPos.z };
      return 'investigate';
    }

    return null;
  }

  // B3: Increase frustration when goose escapes with item
  addFrustration() {
    if (this.frustration < this.maxFrustration) {
      this.frustration++;
      this.villager.setFrustration(this.frustration);
    }
  }

  moveToward(from, to, speed, dt) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.1) return;

    const nx = dx / dist;
    const nz = dz / dist;

    from.x += nx * speed * dt;
    from.z += nz * speed * dt;

    // Prevent villagers from entering the pond
    const pondX = -8, pondZ = 10, pondR = 4.0;
    const toPondX = from.x - pondX;
    const toPondZ = from.z - pondZ;
    const pondDist = Math.sqrt(toPondX * toPondX + toPondZ * toPondZ);
    if (pondDist < pondR) {
      from.x = pondX + (toPondX / pondDist) * pondR;
      from.z = pondZ + (toPondZ / pondDist) * pondR;
    }

    // Avoid zones (skipped during chase so villager can stumble in)
    if (this.state !== State.CHASE) {
      for (const zone of this.avoidZones) {
        const zx = from.x - zone.x;
        const zz = from.z - zone.z;
        const zd = Math.sqrt(zx * zx + zz * zz);
        if (zd < zone.r) {
          from.x = zone.x + (zx / zd) * zone.r;
          from.z = zone.z + (zz / zd) * zone.r;
        }
      }
    }

    // Avoid tipped bins
    if (gameStateBins) {
      for (const bin of gameStateBins) {
        if (!bin.tipped) continue;
        const bx = from.x - bin.x;
        const bz = from.z - bin.z;
        const bd = Math.sqrt(bx * bx + bz * bz);
        if (bd < 0.8) {
          from.x = bin.x + (bx / bd) * 0.8;
          from.z = bin.z + (bz / bd) * 0.8;
        }
      }
    }

    this.villager.group.rotation.y = Math.atan2(nx, nz);
  }

  faceTarget(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    this.villager.group.rotation.y = Math.atan2(dx, dz);
  }

  checkProvocation(gameState) {
    // Check if goose is carrying an item this villager watches
    if (gameState.gooseCarrying && this.watchedItems.includes(gameState.gooseCarrying)) {
      this.isProvoked = true;
      return true;
    }
    return this.isProvoked;
  }

  provoke() {
    this.isProvoked = true;
  }

  getState() {
    return this.state;
  }
}

// Module-level reference for tipped bins (set by main.js)
let gameStateBins = null;
export function setGameBins(bins) {
  gameStateBins = bins;
}
