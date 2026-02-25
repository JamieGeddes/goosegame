export const TASKS = [
  {
    id: 'steal_hat',
    text: 'Steal the gardener\'s hat',
    check(state) {
      // Hat is being carried or has been moved far from its original position
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
];
