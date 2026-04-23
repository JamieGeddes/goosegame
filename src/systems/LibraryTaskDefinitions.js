import { distXZ } from '../utils/MathHelpers.js';

const DESK_POS = { x: -7, z: -13 };
const TALL_SHELF_POS = { x: 8, z: 7.3 };

function meanHomeSlot(books, color) {
  let n = 0, sx = 0, sz = 0;
  for (const b of books) {
    if (b.bookColor === color && b.homeSlot) {
      sx += b.homeSlot.x;
      sz += b.homeSlot.z;
      n++;
    }
  }
  if (!n) return null;
  return { x: sx / n, z: sz / n };
}

export const LIBRARY_TASKS = [
  {
    id: 'sneak_in',
    text: 'Sneak into the library without being spotted',
    check(state) {
      return state.events.sneakedIn === true;
    },
  },
  {
    id: 'disturb_readers',
    text: 'Disturb every reader with a honk',
    check(state) {
      return state.events.readersDisturbed >= state.events.readerCount;
    },
  },
  {
    id: 'swap_books',
    text: 'Swap the red and blue books',
    check(state) {
      const books = state.objects.getCarriables().filter(o => o.bookColor);
      if (books.length === 0) return false;
      const redCentre = meanHomeSlot(books, 'red');
      const blueCentre = meanHomeSlot(books, 'blue');
      if (!redCentre || !blueCentre) return false;
      for (const book of books) {
        if (book.isCarried) return false;
        const pos = book.droppedPosition;
        const home = book.homeSlot;
        if (distXZ(pos, home) <= 1.5) return false;
        const ownCentre = book.bookColor === 'red' ? redCentre : blueCentre;
        const targetCentre = book.bookColor === 'red' ? blueCentre : redCentre;
        if (distXZ(pos, targetCentre) >= distXZ(pos, ownCentre)) return false;
      }
      return true;
    },
  },
  {
    id: 'steal_stepladder',
    text: 'Steal the stepladder',
    check(state) {
      const ladder = state.objects.getByName('stepladder');
      if (!ladder) return false;
      return state.events.stepladderStolen === true;
    },
  },
  {
    id: 'fire_alarm',
    text: 'Set off the fire alarm',
    check(state) {
      return state.events.fireAlarmPulled === true;
    },
  },
  {
    id: 'knock_quiet_signs',
    text: 'Knock over every "Quiet Please" sign',
    check(state) {
      return state.events.quietSignsKnocked >= state.events.quietSignCount;
    },
  },
  {
    id: 'upside_down_book',
    text: 'Reshelve a book upside down',
    check(state) {
      return state.events.bookReshelvedUpsideDown === true;
    },
  },
  {
    id: 'steal_glasses',
    text: "Steal the librarian's reading glasses",
    check(state) {
      const glasses = state.objects.getByName('librarianGlasses');
      if (!glasses) return false;
      if (glasses.isCarried) return true;
      const dist = distXZ(glasses.droppedPosition, DESK_POS);
      return dist > 5;
    },
  },
  {
    id: 'topple_shelves',
    text: 'Bring down every bookshelf',
    check(state) {
      return state.events.shelvesToppled === true;
    },
  },
];

export const LIBRARY_SHELF_POS = {
  DESK_POS,
  TALL_SHELF_POS,
};
