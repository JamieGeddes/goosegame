import { StartScreen } from './StartScreen.js';
import { TaskListUI } from './TaskListUI.js';
import { HonkIndicator } from './HonkIndicator.js';

export class UIManager {
  constructor(onPlay) {
    this.startScreen = new StartScreen(onPlay);
    this.taskList = new TaskListUI();
    this.honkIndicator = new HonkIndicator();
    this.victoryScreen = document.getElementById('victory-screen');

    // F1: Speedrun timer
    this.speedrunEl = null;
    this.createSpeedrunUI();

    // F1: Speedrun button (shown after first completion)
    this.speedrunBtn = null;

    // F2: Horrible mode
    this.isHorribleMode = false;

    this.onSpeedrun = null;
    this.onHorribleMode = null;
  }

  createSpeedrunUI() {
    // Timer display
    this.speedrunEl = document.createElement('div');
    this.speedrunEl.id = 'speedrun-timer';
    this.speedrunEl.style.cssText = `
      display: none; position: fixed; top: 16px; right: 16px; z-index: 50;
      background: rgba(0,0,0,0.7); color: #FFD700; padding: 8px 16px;
      border-radius: 8px; font-family: monospace; font-size: 18px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(this.speedrunEl);
  }

  showGame(tasks) {
    this.taskList.setTasks(tasks);
    this.taskList.show();
  }

  honk() {
    this.honkIndicator.show();
  }

  completeTask(task) {
    this.taskList.completeTask(task.id);
  }

  showVictory(isHorrible = false) {
    this.victoryScreen.style.display = 'flex';
    const h1 = this.victoryScreen.querySelector('h1');
    const p = this.victoryScreen.querySelector('p');

    if (isHorrible) {
      h1.textContent = 'ABSOLUTE MENACE';
      p.textContent = 'You were an ABSOLUTE MENACE to this village.';
    } else {
      h1.textContent = 'YOU DID IT!';
      p.textContent = 'You were the most horrible goose.';
    }

    // F1/F2: Show post-completion buttons after delay
    this.showPostCompletionButtons();
  }

  showPostCompletionButtons() {
    // Remove existing buttons if any
    const existing = this.victoryScreen.querySelector('.post-buttons');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'post-buttons';
    container.style.cssText = 'margin-top: 24px; display: flex; gap: 16px;';

    // F1: Speedrun button
    const speedrunBtn = document.createElement('button');
    speedrunBtn.textContent = 'SPEEDRUN';
    speedrunBtn.style.cssText = `
      padding: 10px 32px; font-size: 18px; font-family: Georgia, serif;
      background: #FFD700; color: #333; border: 2px solid #B8860B;
      border-radius: 6px; cursor: pointer; font-weight: bold;
    `;
    speedrunBtn.addEventListener('click', () => {
      this.victoryScreen.style.display = 'none';
      if (this.onSpeedrun) this.onSpeedrun();
    });
    container.appendChild(speedrunBtn);

    // F2: Horrible mode button (only if not already in horrible mode)
    if (!this.isHorribleMode) {
      const horribleBtn = document.createElement('button');
      horribleBtn.textContent = 'HORRIBLE GOOSE MODE';
      horribleBtn.style.cssText = `
        padding: 10px 32px; font-size: 18px; font-family: Georgia, serif;
        background: #cc2020; color: #fff; border: 2px solid #991010;
        border-radius: 6px; cursor: pointer; font-weight: bold;
      `;
      horribleBtn.addEventListener('click', () => {
        this.victoryScreen.style.display = 'none';
        this.isHorribleMode = true;
        if (this.onHorribleMode) this.onHorribleMode();
      });
      container.appendChild(horribleBtn);
    }

    this.victoryScreen.appendChild(container);
  }

  // F2: Show horrible task list
  showHorribleTasks(tasks) {
    this.taskList.setTasks(tasks, 'Horrible Goose:');
    this.taskList.show();
  }

  completeHorribleTask(task) {
    this.taskList.completeTask(task.id);
  }

  // F1: Speedrun timer
  showSpeedrunTimer() {
    this.speedrunEl.style.display = 'block';
  }

  hideSpeedrunTimer() {
    this.speedrunEl.style.display = 'none';
  }

  updateSpeedrunTimer(time, personalBest) {
    const fmt = (t) => {
      const m = Math.floor(t / 60);
      const s = (t % 60).toFixed(1);
      return `${m}:${s.padStart(4, '0')}`;
    };
    let text = fmt(time);
    if (personalBest !== null) {
      text += ` (PB: ${fmt(personalBest)})`;
    }
    this.speedrunEl.textContent = text;
  }

  update(dt) {
    this.honkIndicator.update(dt);
  }
}
