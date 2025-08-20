let tasks = [];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);


const els = {
    taskTitle: document.getElementById('taskTitle'),
    taskPriority: document.getElementById('taskPriority'),
    taskStatus: document.getElementById('taskStatus'),
    dueDate: document.getElementById('dueDate'),
    repeatTask: document.getElementById('repeatTask'),
    taskList: document.getElementById('taskList'),
    addTaskButton: document.getElementById('addTaskBtn')
}

async function load() {
    tasks = await window.api.loadTasks();
    renderTasks();
}

function save() {
    console.log("Saving tasks...");
    console.log(tasks);
    window.api.saveTasks(tasks);
}

function renderTasks() {
    els.taskList.innerHTML = '';
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
                ${task.subtasks.map(s => `<div class="subtask">- ${s}</div>`).join('')}
                </div>
            </x-accordion>`
            : ''
            }
            `;
            els.taskList.appendChild(div);
    });
}

els.addTaskButton.addEventListener('click', () => {
    console.log("Adding task...");
    const title = els.taskTitle.value;
    const taskPriority = els.taskPriority.value;
    const taskStatus = els.taskStatus.value;
    const dueDate = els.dueDate.value;
    const repeat = els.repeatTask.ariaChecked === 'true' ? true : false;

    if(!title) return alert("Enter a task title!");

    const task = { title, taskPriority, taskStatus, dueDate, repeat, subtasks: [] };
    tasks.push(task);

    if (dueDate) {
        const dueTime = new Date(dueDate).getTime() - Date.now();
        if (dueTime > 0) {
            // setTimeout(() => ipcRenderer.send('show-reminder', task), dueTime);
        }
    }

    save();
    renderTasks();
});

els.taskTitle.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        console.log("Enter pressed, adding task...");
        const title = els.taskTitle.value;
        const taskPriority = els.taskPriority.value;
        const taskStatus = els.taskStatus.value;
        const dueDate = els.dueDate.value;
        const repeat = els.repeatTask.ariaChecked === 'true' ? true : false;

        if(!title) return alert("Enter a task title!");

        const task = { title, taskPriority, taskStatus, dueDate, repeat, subtasks: [] };
        tasks.push(task);

        if (dueDate) {
            const dueTime = new Date(dueDate).getTime() - Date.now();
            if (dueTime > 0) {
                // setTimeout(() => ipcRenderer.send('show-reminder', task), dueTime);
            }
        }
    }

    save();
    renderTasks();
});

function addSubtask(index) {
    let sub = '';
    prompt({
        title: 'Add Subtask',
        label: 'Subtask Title:',
        value: '',
        type: 'input',
        index: index
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

function markComplete(index) {
    tasks[index].status = "Completed";
    save();
    renderTasks();
}

function deleteTask(index) {
    tasks.splice(index, 1);
    save();
    renderTasks();
}

function prompt(options) {
    return new Promise((resolve, reject) => {
        if (document.querySelector('.prompt-dialog')) {
            const existingDialog = document.querySelector('.prompt-dialog');
            if (existingDialog.parentNode) {
                existingDialog.parentNode.removeChild(existingDialog);
            }
        }
        const { title, label, value, type, index } = options;
        const input = document.createElement('input');
        const taskDiv = els.taskList.children[index];
        input.type = type || 'text';
        input.value = value || '';
        input.placeholder = label;

        const dialog = document.createElement('div');
        dialog.className = 'prompt-dialog';
        dialog.innerHTML = `<h3>${title}</h3>`;
        dialog.appendChild(input);

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.onclick = () => {
            resolve(input.value);
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