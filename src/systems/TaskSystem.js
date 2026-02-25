import { TASKS } from './TaskDefinitions.js';

export class TaskSystem {
  constructor(audioManager) {
    this.audio = audioManager;
    this.tasks = TASKS.map(t => ({
      ...t,
      completed: false,
    }));
    this.allComplete = false;
    this.onTaskComplete = null;
    this.onAllComplete = null;
  }

  update(state) {
    if (this.allComplete) return;

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
      if (this.onAllComplete) this.onAllComplete();
    }
  }

  getTasks() {
    return this.tasks;
  }

  isAllComplete() {
    return this.allComplete;
  }
}
