import { StartScreen } from './StartScreen.js';
import { TaskListUI } from './TaskListUI.js';
import { HonkIndicator } from './HonkIndicator.js';

export class UIManager {
  constructor(onPlay) {
    this.startScreen = new StartScreen(onPlay);
    this.taskList = new TaskListUI();
    this.honkIndicator = new HonkIndicator();
    this.victoryScreen = document.getElementById('victory-screen');
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

  showVictory() {
    this.victoryScreen.style.display = 'flex';
  }

  update(dt) {
    this.honkIndicator.update(dt);
  }
}
