const { contextBridge, ipcRenderer } = require('electron');
// const { DateTime } = require('luxon');

contextBridge.exposeInMainWorld('api', {
    loadTasks: () => ipcRenderer.invoke('get-tasks'),
    saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
    showReminder: (task) => ipcRenderer.send('show-reminder', task),
    notify: (opts) => ipcRenderer.invoke('notify', opts),
    formatDate: (iso, zone) => ipcRenderer.invoke('format-date', iso, zone),
    toJSDate: (isoString) => ipcRenderer.invoke('to-js-date', isoString),
    scheduleReminder: (task, dueDate) => ipcRenderer.invoke('schedule-reminder', task, dueDate),
    createTask: (task) => ipcRenderer.invoke('create-task', task),
    updateTask: (id, updatedData) => ipcRenderer.invoke('update-task', id, updatedData),
    deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
    addSubtask: (parentId, subtask) => ipcRenderer.invoke('add-subtask', parentId, subtask),
    removeSubtask: (parentId, subtaskId) => ipcRenderer.invoke('remove-subtask', parentId, subtaskId)
})