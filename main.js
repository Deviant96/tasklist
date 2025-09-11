const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { DateTime } = require('luxon');

const dataFilePath = path.join(__dirname, 'tasks.json');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function loadTasks() {
    if (!fs.existsSync(dataFilePath)) return [];
    return JSON.parse(fs.readFileSync(dataFilePath));
}

function saveTasks(tasks) {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(tasks, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving tasks:', err);
        return false;
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 360,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'renderer/assets/app_icon.png')
    });

    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
    win.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle('get-tasks', () => loadTasks());
    ipcMain.handle('save-tasks', (_, tasks)  => { saveTasks(tasks); return true });
    ipcMain.handle('notify', (_, { title, body }) => {
        if (Notification.isSupported()) new Notification({ title, body }).show();
        return true;
    });
    ipcMain.handle('format-date', (_, iso, zone = 'local') => {
        return DateTime.fromISO(iso, { zone: zone });
    });
    ipcMain.handle('to-js-date', (_, isoString) => {
        return DateTime.fromISO(isoString).toJSDate();
    });

    ipcMain.handle('schedule-reminder', (_, task, dueDateIso) => {
        const dueDate = DateTime.fromISO(dueDateIso, { zone: 'local' }).toJSDate();
        if (isNaN(dueDate.getTime()) || dueDate < new Date()) {
            console.error("Invalid or past due date:", dueDateIso);
            return false;
        }

        const job = schedule.scheduleJob(dueDate, () => {
            if (Notification.isSupported()) {
                new Notification({
                    title: `Task due: ${task.title}`,
                    body: `Priority: ${task.taskPriority || 'N/A'}`
                }).show();
            }
        });

        return !!job;
    });

    ipcMain.handle('create-task', (_, task) => {
        const tasks = loadTasks();
        tasks.push(task);
        return saveTasks(tasks);
    });

    ipcMain.handle('update-task', (_, id, updatedData) => {
        const tasks = loadTasks();
        const taskIndex = tasks.findIndex(task => task.id === id);
        if (taskIndex === -1) return false;

        tasks[taskIndex] = { ...tasks[taskIndex], ...updatedData, updatedDate: new Date().toISOString() };
        return saveTasks(tasks);
    });

    ipcMain.handle('delete-task', (_, id) => {
        const tasks = loadTasks();
        const updatedTasks = tasks.filter(task => task.id !== id);
        return saveTasks(updatedTasks);
    });

    ipcMain.handle('add-subtask', (_, parentId, subtask) => {
        const tasks = loadTasks();
        const parentTask = tasks.find(task => task.id === parentId);
        
        if (!parentTask) return false;
        if (!Array.isArray(parentTask.subtasks)) parentTask.subtasks = [];

        parentTask.subtasks.push(subtask);
        return saveTasks(tasks);
    });

    ipcMain.handle('remove-subtask', (_, parentId, subtaskId) => {
        const tasks = loadTasks();
        const parentTask = tasks.find(task => task.id === parentId);
        if (!parentTask) return false;

        parentTask.subtasks = parentTask.subtasks.filter(s => s.id !== subtaskId);
        return saveTasks(tasks);
    });
});

ipcMain.on('show-reminder', (_, task) => {
    new Notification({
        title: "Task Reminder",
        body: `${task.title} is due!`
    }).show();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

