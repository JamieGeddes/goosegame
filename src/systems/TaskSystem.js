import { TASKS, HORRIBLE_TASKS } from './TaskDefinitions.js';

export class TaskSystem {
  constructor(audioManager, options = {}) {
    this.audio = audioManager;
    const taskSource = options.tasks || TASKS;
    const horribleSource = options.horribleTasks || HORRIBLE_TASKS;
    this.levelId = options.levelId || 'village';
    this.tasks = taskSource.map(t => ({ ...t, completed: false }));
    this.allComplete = false;
    this.onTaskComplete = null;
    this.onAllComplete = null;

    // F2: Second tier tasks
    this.horribleTasks = horribleSource.map(t => ({ ...t, completed: false }));
    this.isHorribleMode = false;
    this.horribleComplete = false;
    this.onHorribleTaskComplete = null;
    this.onHorribleComplete = null;

    // F1: Speedrun timer (per-level PB)
    this.speedrunActive = false;
    this.speedrunTime = 0;
    this.personalBest = this.loadPersonalBest();
    this.hasCompletedOnce = this.personalBest !== null;
  }

  update(state) {
    // F1: Update speedrun timer
    if (this.speedrunActive) {
      this.speedrunTime += state.dt || 0;
    }

    // Check primary tasks
    if (!this.allComplete) {
      let newCompletion = false;
      for (const task of this.tasks) {
        if (task.completed) continue;
        if (task.check(state)) {
          task.completed = true;
          newCompletion = true;
          this.audio.taskComplete();
          if (this.onTaskComplete) this.onTaskComplete(task);
        }
      }

      if (newCompletion && this.tasks.every(t => t.completed)) {
        this.allComplete = true;
        this.hasCompletedOnce = true;

        // F1: Save speedrun time
        if (this.speedrunActive) {
          if (this.personalBest === null || this.speedrunTime < this.personalBest) {
            this.personalBest = this.speedrunTime;
            this.savePersonalBest();
          }
        }

        if (this.onAllComplete) this.onAllComplete();
      }
    }

    // F2: Check horrible tasks
    if (this.isHorribleMode && !this.horribleComplete) {
      let newCompletion = false;
      for (const task of this.horribleTasks) {
        if (task.completed) continue;
        if (task.check(state)) {
          task.completed = true;
          newCompletion = true;
          this.audio.taskComplete();
          if (this.onHorribleTaskComplete) this.onHorribleTaskComplete(task);
        }
      }

      if (newCompletion && this.horribleTasks.every(t => t.completed)) {
        this.horribleComplete = true;
        if (this.onHorribleComplete) this.onHorribleComplete();
      }
    }
  }

  getTasks() {
    return this.tasks;
  }

  getHorribleTasks() {
    return this.horribleTasks;
  }

  isAllComplete() {
    return this.allComplete;
  }

  // F2: Start horrible mode
  startHorribleMode() {
    this.isHorribleMode = true;
  }

  // F1: Speedrun management
  startSpeedrun() {
    this.speedrunActive = true;
    this.speedrunTime = 0;
    // Reset all tasks
    for (const task of this.tasks) task.completed = false;
    this.allComplete = false;
  }

  getSpeedrunTime() {
    return this.speedrunTime;
  }

  getPersonalBest() {
    return this.personalBest;
  }

  loadPersonalBest() {
    try {
      const val = localStorage.getItem(`goose_speedrun_pb_${this.levelId}`);
      return val ? parseFloat(val) : null;
    } catch {
      return null;
    }
  }

  savePersonalBest() {
    try {
      localStorage.setItem(`goose_speedrun_pb_${this.levelId}`, this.speedrunTime.toString());
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}
