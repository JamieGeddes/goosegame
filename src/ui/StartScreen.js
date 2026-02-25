export class StartScreen {
  constructor(onPlay) {
    this.element = document.getElementById('start-screen');
    this.playBtn = document.getElementById('play-btn');

    this.playBtn.addEventListener('click', () => {
      this.hide();
      onPlay();
    });
  }

  hide() {
    this.element.style.display = 'none';
  }

  show() {
    this.element.style.display = 'flex';
  }
}
