// To‑Do app with localStorage persistence
(function () {
  var STORAGE_KEY = 'climate_todos_v1';

  var todoForm = document.getElementById('todoForm');
  var newTaskInput = document.getElementById('newTask');
  var taskList = document.getElementById('taskList');
  var clearCompletedBtn = document.getElementById('clearCompleted');
  var filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
  var todoNotice = document.getElementById('todoNotice');

  var tasks = [];
  var currentFilter = 'all';

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load tasks', e);
      tasks = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function render() {
    taskList.innerHTML = '';
    var filtered = tasks.filter(function (t) {
      if (currentFilter === 'active') return !t.completed;
      if (currentFilter === 'completed') return t.completed;
      return true;
    });

    if (filtered.length === 0) {
      todoNotice.textContent = 'No tasks for the selected filter.';
      todoNotice.setAttribute('aria-hidden', 'false');
    } else {
      todoNotice.textContent = '';
      todoNotice.setAttribute('aria-hidden', 'true');
    }

    filtered.forEach(function (task) {
      var li = document.createElement('li');
      li.className = 'task-item' + (task.completed ? ' completed' : '');
      li.setAttribute('data-id', task.id);

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!task.completed;
      checkbox.setAttribute('aria-label', 'Mark task complete');

      var span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;
      span.tabIndex = 0;
      span.setAttribute('role', 'textbox');
      span.setAttribute('aria-label', 'Task text. Press enter to edit.');

      var actions = document.createElement('div');
      actions.className = 'task-actions';

      var editBtn = document.createElement('button');
      editBtn.className = 'edit';
      editBtn.title = 'Edit';
      editBtn.innerHTML = '✎';
      editBtn.setAttribute('aria-label', 'Edit task');

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '🗑';
      deleteBtn.setAttribute('aria-label', 'Delete task');

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(actions);
      taskList.appendChild(li);
    });
  }

  function addTask(text) {
    var t = {
      id: uid(),
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    if (!t.text) return;
    tasks.unshift(t);
    save();
    render();
  }

  function toggleTask(id) {
    var t = tasks.find(function (x) { return x.id === id; });
    if (t) {
      t.completed = !t.completed;
      save();
      render();
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter(function (x) { return x.id !== id; });
    save();
    render();
  }

  function editTask(id, newText) {
    var t = tasks.find(function (x) { return x.id === id; });
    if (t) {
      t.text = newText.trim();
      save();
      render();
    }
  }

  // Events
  todoForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = newTaskInput.value;
    if (!v.trim()) return;
    addTask(v);
    newTaskInput.value = '';
    newTaskInput.focus();
  });

  taskList.addEventListener('click', function (e) {
    var li = e.target.closest('li.task-item');
    if (!li) return;
    var id = li.getAttribute('data-id');
    if (e.target.matches('input[type="checkbox"]')) {
      toggleTask(id);
    } else if (e.target.classList.contains('delete')) {
      deleteTask(id);
    } else if (e.target.classList.contains('edit')) {
      // simple inline edit
      var span = li.querySelector('.task-text');
      var current = span.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.className = 'editing';
      input.style.flex = '1';
      span.replaceWith(input);
      input.focus();
      input.setSelectionRange(current.length, current.length);

      function finish() {
        var v = input.value.trim();
        if (v) editTask(id, v);
        else deleteTask(id);
      }

      input.addEventListener('blur', finish, { once: true });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          finish();
        } else if (ev.key === 'Escape') {
          render();
        }
      });
    }
  });

  // Keyboard: Enter to edit from span
  taskList.addEventListener('keydown', function (e) {
    if (e.target.classList.contains('task-text') && (e.key === 'Enter')) {
      e.preventDefault();
      var li = e.target.closest('li.task-item');
      var id = li.getAttribute('data-id');
      li.querySelector('.edit').click();
    }
  });

  clearCompletedBtn.addEventListener('click', function () {
    tasks = tasks.filter(function (t) { return !t.completed; });
    save();
    render();
  });

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      render();
    });
  });

  // init
  load();
  render();
})();