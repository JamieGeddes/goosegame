import { Ground } from './Ground.js';
import { Buildings } from './Buildings.js';
import { Gardens } from './Gardens.js';
import { Pond } from './Pond.js';
import { Trees } from './Trees.js';
import { Props } from './Props.js';

export class Village {
  constructor(scene, collisionManager) {
    this.scene = scene;
    this.collision = collisionManager;

    this.ground = new Ground();
    this.buildings = new Buildings(collisionManager);
    this.gardens = new Gardens(collisionManager);
    this.pond = new Pond();
    this.trees = new Trees(collisionManager);
    this.props = new Props(collisionManager);

    scene.add(this.ground.group);
    scene.add(this.buildings.group);
    scene.add(this.gardens.group);
    scene.add(this.pond.group);
    scene.add(this.trees.group);
    scene.add(this.props.group);
  }

  update(dt, elapsed) {
    this.pond.update(dt, elapsed);
  }

  isOverWater(pos) {
    return this.pond.isOverWater(pos);
  }
}
