const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

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

