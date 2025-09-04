const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { DateTime } = require('luxon');

const dataFilePath = path.join(__dirname, 'tasks.json');

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
        width: 500,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'renderer/assets/app_icon.png') // Update this path
    });

    // Load dev tools if in development
    // if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    // }
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

