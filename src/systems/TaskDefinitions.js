import { distXZ } from '../utils/MathHelpers.js';

export const TASKS = [
  {
    id: 'steal_hat',
    text: 'Steal the gardener\'s hat',
    check(state) {
      const hat = state.objects.getByName('gardenerHat');
      if (!hat) return false;
      if (hat.isCarried) return true;
      const dist = Math.sqrt(
        (hat.droppedPosition.x - 14) ** 2 + (hat.droppedPosition.z - (-4)) ** 2
      );
      return dist > 5;
    },
  },
  {
    id: 'rake_in_pond',
    text: 'Throw the rake in the pond',
    check(state) {
      const rake = state.objects.getByName('rake');
      if (!rake || rake.isCarried) return false;
      return state.village.isOverWater(rake.droppedPosition);
    },
  },
  {
    id: 'boy_in_puddle',
    text: 'Get the boy to fall in the puddle',
    check(state) {
      return state.events.boyFellInPuddle === true;
    },
  },
  {
    id: 'trap_shopkeeper',
    text: 'Trap the shopkeeper in the phone booth',
    check(state) {
      return state.events.shopkeeperTrapped === true;
    },
  },
  {
    id: 'steal_sandwich',
    text: 'Steal the picnic sandwich',
    check(state) {
      const sandwich = state.objects.getByName('sandwich');
      if (!sandwich) return false;
      if (sandwich.isCarried) return true;
      const dist = Math.sqrt(
        (sandwich.droppedPosition.x - 12) ** 2 + (sandwich.droppedPosition.z - 11.5) ** 2
      );
      return dist > 5;
    },
  },
  {
    id: 'ring_bell',
    text: 'Ring the pub bell',
    check(state) {
      const bell = state.objects.getByName('pubBell');
      return bell && bell.hasBeenRung;
    },
  },
  {
    id: 'sneak_garden',
    text: 'Get into the garden without being caught',
    check(state) {
      return state.events.sneakedIntoGarden === true;
    },
  },
  {
    id: 'steal_glasses',
    text: 'Steal the old lady\'s glasses',
    check(state) {
      const glasses = state.objects.getByName('glasses');
      if (!glasses) return false;
      if (glasses.isCarried) return true;
      const dist = Math.sqrt(
        (glasses.droppedPosition.x - (-5)) ** 2 + (glasses.droppedPosition.z - 16) ** 2
      );
      return dist > 5;
    },
  },
  // E1: Get the gardener wet
  {
    id: 'gardener_wet',
    text: 'Get the gardener wet',
    check(state) {
      return state.events.gardenerWet === true;
    },
  },
  // E2: Lead the shopkeeper to the pub
  {
    id: 'shopkeeper_pub',
    text: 'Lead the shopkeeper to the pub',
    check(state) {
      return state.events.shopkeeperAtPub === true;
    },
  },
  // E3: Arrange a picnic at the fountain
  {
    id: 'fountain_picnic',
    text: 'Arrange a picnic at the fountain',
    check(state) {
      const sandwich = state.objects.getByName('sandwich');
      const apple = state.objects.getByName('apple');
      if (!sandwich || !apple) return false;
      if (sandwich.isCarried || apple.isCarried) return false;
      const fountainPos = { x: 0, z: -6 };
      const sandDist = distXZ(sandwich.droppedPosition, fountainPos);
      const appleDist = distXZ(apple.droppedPosition, fountainPos);
      return sandDist < 2 && appleDist < 2;
    },
  },
  // E4: Chase the boy into the pond
  {
    id: 'boy_in_pond',
    text: 'Chase the boy into the pond',
    check(state) {
      return state.events.boyInPond === true;
    },
  },
  // E5: Lock the gardener out
  {
    id: 'lock_gardener_out',
    text: 'Lock the gardener out of the garden',
    check(state) {
      return state.events.gardenerLockedOut === true;
    },
  },
];

// F2: Second tier "Horrible Goose" task list
export const HORRIBLE_TASKS = [
  {
    id: 'all_items_fountain',
    text: 'Collect every item at the fountain',
    check(state) {
      const fountainPos = { x: 0, z: -6 };
      const carriables = state.objects.getCarriables();
      for (const obj of carriables) {
        if (obj.isCarried) return false;
        if (distXZ(obj.droppedPosition, fountainPos) > 3) return false;
      }
      return true;
    },
  },
  {
    id: 'no_catch_run',
    text: 'Complete all tasks without being caught',
    check(state) {
      // This is tracked via a flag set when goose is caught
      return state.events.completedWithoutCatch === true;
    },
  },
  {
    id: 'all_frustrated',
    text: 'Make every NPC frustrated',
    check(state) {
      return state.events.allFrustrated === true;
    },
  },
];
