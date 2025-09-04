const { schedule, formatDate, toJSDate } = window.api;

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

async function save() {
    await window.api.saveTasks(tasks);
}

function renderTasks() {
    els.taskList.innerHTML = '';
    tasks.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    tasks.forEach((task, index) => {
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
                          task.taskStatus === 'done' ? 'Done' :
                            task.taskStatus === 'todo' ? 'To Do' : 'Unknown';

        const div = document.createElement('x-card');
        div.className = 'task';
        div.innerHTML = `
            <div class="task-main">
            <div class="task-content">
            <span id="task-id" style="display:none;">${task.id}</span>
            <strong>${task.title}</strong> <span class="task-priority">(${taskPriority})</span> - <span class="task-status">${taskStatus}</span>
            <br>
            <span class="task-due-date">${taskDueDate}</span> ${taskRepeat}
            </div>
            <div class="task-actions" style="gap: 5px;">
            <x-button size="small" skin="recessed"  class="btn-delete-task"onclick="deleteTask(${index})" aria-label="Delete Task">
            <img class="icon" src="./assets/trash_bin.png">
            </x-button>

            <x-button size="small" skin="recessed" onclick="addSubtask(${index})" class="btn-add-subtask">
            <img class="icon" src="./assets/plus.png">
            <x-label>Subtask</x-label>
            </x-button>

            <x-button class="btn-complete-task" size="small" skin="recessed" onclick="markComplete(${index})" aria-label="Mark task as complete">
            <img class="icon" src="./assets/check.png">
            </x-button>
            </div>
            </div>
            ${
            task.subtasks && task.subtasks.length > 0
            ? `<x-accordion class="subtasks">
            <header>
            <x-label>Subtasks</x-label>
            </header>
            <div>
            ${task.subtasks.map((s, subIndex) => `
                <div class="subtask">
                - ${s}
                <x-button size="small" skin="recessed" class="btn-remove-subtask" onclick="removeSubtask(${index}, ${subIndex})" aria-label="Remove Subtask">
                    <img class="icon" src="./assets/trash_bin.png">
                </x-button>
                </div>
            `).join('')}
            </div>
            </x-accordion>`
            : ''
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
    tasks.push(task);

    scheduleReminder(task);

    task.createdDate = new Date().toISOString();
    task.updatedDate = new Date().toISOString();

    els.notification.opened = true;
    els.notification.innerText = "Task added successfully!";

    save();
    renderTasks();
}

els.addTaskButton.addEventListener('click', addTask);

els.taskTitle.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask();
    }
});

function addSubtask(index) {
    let sub = '';
    prompt({
        title: 'Add Subtask',
        label: 'Subtask Title:',
        value: '',
        type: 'input',
        index: index,
        autofocus: true
    })
    .then((r) => {
        console.log("Subtask input received:", r);
        if(r === null) {
            console.log("Subtask addition cancelled.");
            return;
        } else {
            sub = r.trim();

            console.log("Adding subtask:", sub);

            if (sub) {
                tasks[index].subtasks.push(sub);
                save();
                renderTasks();
            }
        }
    })
    .catch(console.error);
}

function removeSubtask(taskIndex, subtaskIndex) {
    if (
        tasks[taskIndex] &&
        Array.isArray(tasks[taskIndex].subtasks) &&
        tasks[taskIndex].subtasks[subtaskIndex] !== undefined
    ) {
        tasks[taskIndex].subtasks.splice(subtaskIndex, 1);
        els.notification.opened = true;
        els.notification.innerText = "Subtask removed!";
        save();
        renderTasks();
    } else {
        els.notification.opened = true;
        els.notification.innerText = "Error removing subtask!";
    }
}

function markComplete(index) {
    els.notification.opened = true;
    if (tasks[index].status = "Completed") {
        els.notification.innerText = "Task marked as complete!";
        save();
        renderTasks();
    } else {
        els.notification.innerText = "Error completing task!";
    }
}

/*
 * Delete a task by showing a confirmation dialog
 */
function deleteTask(index) {
    prompt({
        title: 'Confirm Deletion',
        label: 'Are you sure you want to delete this task?',
        type: 'confirm',
        index: index
    })
    .then((confirmed) => {
        if (confirmed) {
            els.notification.opened = true;
            if (tasks.splice(index, 1)) {
                els.notification.innerText = "Task removed!";
                save();
                renderTasks();
            }
        }
    })
    .catch(console.error);
}

function prompt(options) {
    return new Promise((resolve, reject) => {
        if (document.querySelector('.prompt-dialog')) {
            const existingDialog = document.querySelector('.prompt-dialog');
            if (existingDialog.parentNode) {
                existingDialog.parentNode.removeChild(existingDialog);
            }
        }
        const { title, label, value, type, index, autofocus } = options;
        const taskDiv = els.taskList.children[index];
        
        const dialog = document.createElement('div');
        dialog.className = 'prompt-dialog';
        dialog.innerHTML = `<h3>${title}</h3>`;

        if (type === 'confirm') {
            const message = document.createElement('p');
            message.textContent = label;
            dialog.appendChild(message);
        } else {
            const input = document.createElement('input');
            input.type = type || 'text';
            input.value = value || '';
            input.placeholder = label;
            if (autofocus) {
                input.autofocus = true;
            }
            dialog.appendChild(input);
        }


        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.onclick = () => {
            if (type === 'confirm') {
                resolve(true);
            } else {
                resolve(input.value);
            }
            if (taskDiv) {
                taskDiv.removeChild(dialog);
            } else {
                document.body.removeChild(dialog);
            }
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.onclick = () => {
            resolve(null);
            if (taskDiv) {
                taskDiv.removeChild(dialog);
            } else {
                document.body.removeChild(dialog);
            }
        };

        dialog.appendChild(okButton);
        dialog.appendChild(cancelButton);
        
        if (taskDiv) {
            taskDiv.appendChild(dialog);
        } else {
            document.body.appendChild(dialog);
        }
    });
}

load();