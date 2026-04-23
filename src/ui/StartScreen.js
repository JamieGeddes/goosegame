export class StartScreen {
  constructor(onPlay) {
    this.element = document.getElementById('start-screen');
    this.villageBtn = document.getElementById('play-btn-village');
    this.libraryBtn = document.getElementById('play-btn-library');

    if (this.villageBtn) {
      this.villageBtn.addEventListener('click', () => {
        this.hide();
        onPlay('village');
      });
    }
    if (this.libraryBtn) {
      this.libraryBtn.addEventListener('click', () => {
        this.hide();
        onPlay('library');
      });
    }

    // Backward compatibility: older HTML may still have a single play-btn.
    const legacyBtn = document.getElementById('play-btn');
    if (legacyBtn) {
      legacyBtn.addEventListener('click', () => {
        this.hide();
        onPlay('village');
      });
    }
  }

  hide() {
    this.element.style.display = 'none';
  }

  show() {
    this.element.style.display = 'flex';
  }
}
