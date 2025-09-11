const { schedule, formatDate, toJSDate, createTask, updateTask, addSubtask, removeSubtask } = window.api;

let tasks = [];
let scheduledJobs = {};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

const els = {
    taskTitle: document.getElementById('taskTitle'),
    taskPriority: document.getElementById('taskPriority'),
    taskStatus: document.getElementById('taskStatus'),
    dueDate: document.getElementById('dueDate'),
    repeatTask: document.getElementById('repeatTask'),
    taskList: document.getElementById('taskList'),
    addTaskButton: document.getElementById('addTaskBtn'),
    notification: document.getElementById('notification'),
    searchBar: document.getElementById('search'),
    filterStatus: document.getElementById('filterStatus'),
    filterPriority: document.getElementById('filterPriority'),
}

async function scheduleReminder(task) {
    if (!task.dueDate || task.taskStatus === 'completed') return;

    const dueDate = window.api.formatDate(task.dueDate, "local");
    const now = window.api.formatDate(Date.now(), "ff");

    if (dueDate < now) {
        console.log(`Due date for task '${task.title}' has already passed.`);
        els.notification.opened = true;
        els.notification.innerText = `Reminder skipped: '${task.title}' is overdue.`;
        return;
    }

    try {
        const success = await window.api.scheduleReminder(task, task.dueDate);
        console.log("Scheduling result:", success);
        if (success) {
            console.log(`Reminder scheduled for task: ${task.title} at ${task.dueDate}`);
        } else {
            console.error(`Failed to schedule reminder for task: ${task.title}`);
        }
    } catch (err) {
        console.error("Error scheduling reminder:", err);
    }
}


function cancelScheduledReminder(taskId) {
    if (scheduledJobs[taskId]) {
        scheduledJobs[taskId].cancel();
        delete scheduledJobs[taskId];
    }
}

function computeNextDue(task) {
    if (!task.dueDate) return null;
    const date = DateTime.fromISO(task.dueDate, { zone: 'local' });

    if (task.repeat === 'daily') {
        return date.plus({ days: 1 });
    }

    if (task.repeat === 'weekly') {
        return date.plus({ weeks: 1 });
    }

    if (task.repeat === 'monthly') {
        return date.plus({ months: 1 });
    }

    return null;
}

async function load() {
    tasks = await window.api.loadTasks();
    tasks.forEach(scheduleReminder);
    renderTasks();
}

async function refreshTasks() {
    tasks = await window.api.loadTasks();
    renderTasks();
}

async function save() {
    await window.api.saveTasks(tasks);
}

function renderTasks() {
    els.taskList.innerHTML = '';
    const filtered = filterAndSearch(tasks);

    if (filtered.length === 0) els.taskList.innerHTML = '<p>No task found</p>'

    filtered.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    filtered.forEach((task, index) => {
        const taskPriority = task.taskPriority || 'N/A';
        const date = new Date(task.dueDate);

        const options = {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        };

        const formattedDate = date.toLocaleString("en-US", options);
        const taskDueDate = !isNaN(date.getTime()) ? formattedDate : '';
        const taskRepeat = task.repeat === true ? '(Repeats)' : '';
        const taskStatus = task.taskStatus === 'in-progress' ? 'In Progress' :
                          task.taskStatus === 'completed' ? 'Done' :
                            task.taskStatus === 'todo' ? 'To Do' : 'Unknown';

        const div = document.createElement('x-card');
        div.className = `task ${task.taskStatus}`;
        div.innerHTML = `
            <div class="task-main">
                <div class="task-content ${task.taskStatus === 'completed' ? 'completed' : ''}">
                    <span id="task-id" style="display:none;">${task.id}</span>
                    <strong>${task.title}</strong> <span class="task-priority">(${taskPriority})</span> - <span class="task-status">${taskStatus}</span>
                    <br>
                    <span class="task-due-date">${taskDueDate}</span> ${taskRepeat}
                </div>
                <div class="task-actions" style="gap: 5px;">
                    ${task.taskStatus !== 'completed' ? `
                    <x-button size="small" skin="recessed"  class="btn-delete-task"onclick="deleteTask('${task.id}')" aria-label="Delete Task">
                        <img class="icon" src="./assets/trash_bin.png">
                    </x-button>

                    <x-button size="small" skin="recessed" onclick="createSubtask('${task.id}')" class="btn-add-subtask">
                        <img class="icon" src="./assets/plus.png">
                        <x-label>Subtask</x-label>
                    </x-button>

                    <x-button class="btn-complete-task" size="small" skin="recessed" onclick="markComplete('${task.id}')" aria-label="Mark task as complete">
                        <img class="icon" src="./assets/check.png">
                    </x-button>
                    ` : `
                    <x-button class="btn-complete-revert-complete" size="small" skin="recessed" onclick="markUncomplete('${task.id}')" aria-label="Revert task as uncomplete">
                        <img class="icon" src="./assets/revert.png">
                    </x-button>
                    `}
                </div>
            </div>
            ${
            task.subtasks && task.subtasks.length > 0
            ? `
            <x-accordion class="subtasks">
                <header>
                    <x-label>Subtasks</x-label>
                </header>
                <div>
                    ${task.subtasks.map((s) => `
                        <div class="subtask">
                        - ${s.title}
                        <x-button size="small" skin="recessed" class="btn-remove-subtask" onclick="deleteSubtask('${task.id}', '${s.id}')" aria-label="Remove Subtask">
                            <img class="icon" src="./assets/trash_bin.png">
                        </x-button>
                        </div>
                    `).join('')}
                </div>
            </x-accordion>
            ` : ''
            }
            `;
            els.taskList.appendChild(div);
    });
}

function getTaskInput() {
    return {
        id: uid(),
        title: els.taskTitle.value.trim(),
        taskPriority: els.taskPriority.value,
        taskStatus: els.taskStatus.value,
        dueDate: els.dueDate.value,
        repeat: els.repeatTask.ariaChecked === 'true',
        subtasks: [],
        createdDate: null,
        updatedDate: null,
    };
}

function addTask() {
    const task = getTaskInput();
    if (!task.title) {
        els.notification.opened = true;
        els.notification.innerText = "Task title cannot be empty!";
        return;
    }

    task.createdDate = new Date().toISOString();
    task.updatedDate = new Date().toISOString();

    createTask(task);
    scheduleReminder(task);

    els.notification.opened = true;
    els.notification.innerText = "Task added successfully!";

    refreshTasks();
}

els.addTaskButton.addEventListener('click', addTask);

els.taskTitle.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask();
    }
});

function createSubtask(parentId) {
    let subtask = {};
    prompt({
        title: 'Add Subtask',
        label: 'Subtask Title:',
        value: '',
        type: 'input',
        index: parentId,
        autofocus: true
    })
    .then((r) => {
        if(r === null) {
            return;
        } else {
            const subtaskTitle = r.trim();
            if (!subtaskTitle) {
                els.notification.opened = true;
                els.notification.innerText = "Subtask title cannot be empty!";
                return;
            }

            subtask = { id: uid(), title: subtaskTitle };

            addSubtask(parentId, subtask).then((res) => {
                if (res === true) {
                    els.notification.opened = true;
                    els.notification.innerText = "Subtask added successfully!";
                    refreshTasks();
                } else {
                    els.notification.opened = true;
                    els.notification.innerText = "Error adding subtask!";
                }
            });
        }
    })
    .catch(console.error);
}

function deleteSubtask(parentId, subtaskId) {
    removeSubtask(parentId, subtaskId).then((res) => {
        if (res === true) {
            els.notification.opened = true;
            els.notification.innerText = "Subtask removed successfully!";
            refreshTasks();
        } else {
            els.notification.opened = true;
            els.notification.innerText = "Error removing subtask!";
        }
    });
}

async function markComplete(id) {
    const res = await updateTask(id, { taskStatus: 'completed' });
    if (res === true) {
        els.notification.opened = true;
        els.notification.innerText = "Task marked as completed";
        refreshTasks();
    } else {
        els.notification.opened = true;
        els.notification.innerText = "Error completing task!";
    }
    cancelScheduledReminder(id);
}

async function markUncomplete(id) {
    const res = await updateTask(id, { taskStatus: 'in-progress' });
    if (res === true) {
        els.notification.opened = true;
        els.notification.innerText = "Task marked as uncomplete";
        refreshTasks();
    } else {
        els.notification.opened = true;
        els.notification.innerText = "Error uncompleting task!";
    }
}

/*
 * Delete a task by showing a confirmation dialog
 */
function deleteTask(id) {
    prompt({
        title: 'Confirm Deletion',
        label: 'Are you sure you want to delete this task?',
        type: 'confirm',
        index: id
    })
    .then(async (confirmed) => {
        if (confirmed) {
            els.notification.opened = true;
            const deletionResponse = await window.api.deleteTask(id);
            if (deletionResponse === true) {
                els.notification.innerText = "Task deleted successfully!";
                refreshTasks();
            }
        }
    })
    .catch(console.error);
}

function prompt(options) {
    return new Promise((resolve) => {
        const { title, label, value, type, autofocus } = options;
        const prevFocus = document.activeElement;

        const overlay = document.createElement('div');
        overlay.className = 'prompt-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'prompt-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.innerHTML = `<h3 id="dialog-title">${title}</h3>`;

        let input = null;

        if (type !== 'confirm') {
            const isTextarea = type === 'textarea';
            input = document.createElement(isTextarea ? 'textarea' : 'input');
            if (!isTextarea) {
                input.type = type || 'text';
            }
            input.value = value || '';
            input.placeholder = label || '';
            dialog.appendChild(input);
        } else {
            const message = document.createElement('p');
            message.textContent = label;
            dialog.appendChild(message);
        }

        const buttons = document.createElement('div');
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';

        buttons.appendChild(okButton);
        buttons.appendChild(cancelButton);
        dialog.appendChild(buttons);

        function cleanup() {
            document.body.removeChild(dialog);
            document.body.removeChild(overlay);
            if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
        }

        okButton.onclick = () => {
            resolve(type === 'confirm' ? true : (input ? input.value : null));
            cleanup();
        };

        cancelButton.onclick = () => {
            resolve(null);
            cleanup();
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cancelButton.click();
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelButton.click();
            } else if (e.key === 'Enter' && type !== 'textarea') {
                e.preventDefault();
                okButton.click();
            }
        });

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        requestAnimationFrame(() => {
            const focusTarget = input && autofocus !== false ? input : okButton;
            focusTarget.focus();
            if (input && autofocus) {
                if (typeof input.select === 'function') input.select();
            }
        });
    });
}

function filterAndSearch(tasks) {
    const query = els.searchBar && els.searchBar.value ? els.searchBar.value.trim().toLowerCase() : '';
    const statusFilter = els.filterStatus.value || 'all';
    const priorityFilter = els.filterPriority.value || 'all';

    function matchesFilter(task) {
        const matchesStatus = statusFilter === 'all' || task.taskStatus === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.taskPriority === priorityFilter;
        const matchesQuery = !query || 
            task.title.toLowerCase().includes(query) || 
            (task.subtasks && task.subtasks.some(subtask => subtask.title.toLowerCase().includes(query)));

        return matchesStatus && matchesPriority && matchesQuery;
    }

    function filterTasks(taskList) {
        return taskList
            .map(task => ({
                ...task,
                subtasks: Array.isArray(task.subtasks) && typeof task.subtasks[0] === 'string'
                    ? task.subtasks.filter(subtask => subtask.title.toLowerCase().includes(query))
                    : task.subtasks
            }))
            .filter(task => matchesFilter(task) || (task.subtasks && task.subtasks.length > 0));
    }

    return filterTasks(tasks);
}

els.searchBar.addEventListener('input', renderTasks);
els.filterStatus.addEventListener('change', renderTasks);
els.filterPriority.addEventListener('change', renderTasks);

load();