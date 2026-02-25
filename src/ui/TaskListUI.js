export class TaskListUI {
  constructor() {
    this.container = document.getElementById('task-list');
    this.list = document.getElementById('task-items');
    this.items = new Map();
  }

  show() {
    this.container.style.display = 'block';
  }

  hide() {
    this.container.style.display = 'none';
  }

  setTasks(tasks) {
    this.list.textContent = '';
    this.items.clear();

    for (const task of tasks) {
      const li = document.createElement('li');
      li.dataset.taskId = task.id;

      const checkbox = document.createElement('span');
      checkbox.className = 'checkbox';
      li.appendChild(checkbox);

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;
      li.appendChild(text);

      this.list.appendChild(li);
      this.items.set(task.id, { li, checkbox });
    }
  }

  completeTask(taskId) {
    const item = this.items.get(taskId);
    if (item) {
      item.li.classList.add('completed');
      item.checkbox.textContent = '\u2713';
    }
  }
}
