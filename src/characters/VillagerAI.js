import { distXZ } from '../utils/MathHelpers.js';

const State = {
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  RETURN: 'return',
  GIVE_UP: 'give_up',
};

export class VillagerAI {
  constructor(villager, waypoints, config = {}) {
    this.villager = villager;
    this.waypoints = waypoints;
    this.currentWaypoint = 0;
    this.state = State.PATROL;

    this.patrolSpeed = config.patrolSpeed || 1.5;
    this.chaseSpeed = config.chaseSpeed || 4;
    this.alertRadius = config.alertRadius || 6;
    this.chaseRadius = config.chaseRadius || 4;
    this.giveUpRadius = config.giveUpRadius || 12;
    this.alertTime = config.alertTime || 1.0;

    this.alertTimer = 0;
    this.giveUpTimer = 0;
    this.returnTarget = null;
    this.isProvoked = false;

    // Track stolen items this villager cares about
    this.watchedItems = config.watchedItems || [];
  }

  update(dt, goosePos, gameState) {
    const myPos = this.villager.getPosition();
    const dist = distXZ(myPos, goosePos);

    switch (this.state) {
      case State.PATROL:
        this.doPatrol(dt, myPos, goosePos, dist, gameState);
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
    }

    this.villager.update(dt);
  }

  doPatrol(dt, myPos, goosePos, dist, gameState) {
    this.villager.setAlert(false);

    if (this.waypoints.length === 0) {
      this.villager.isWalking = false;
      return;
    }

    const target = this.waypoints[this.currentWaypoint];
    const toDist = distXZ(myPos, target);

    if (toDist < 0.5) {
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    } else {
      this.moveToward(myPos, target, this.patrolSpeed, dt);
      this.villager.isWalking = true;
    }

    // Check if goose is nearby or provoked
    if (dist < this.alertRadius || this.checkProvocation(gameState)) {
      this.state = State.ALERT;
      this.alertTimer = 0;
      this.villager.isWalking = false;
    }
  }

  doAlert(dt, myPos, goosePos, dist, gameState) {
    this.villager.setAlert(true);
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
    this.villager.isWalking = true;

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
    this.villager.isWalking = false;
    this.giveUpTimer += dt;

    // Head shake animation could go here
    if (this.giveUpTimer > 1.5) {
      this.state = State.RETURN;
      this.isProvoked = false;
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
