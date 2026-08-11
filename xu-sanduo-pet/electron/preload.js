'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sanduo', {
  getBootstrap: () => ipcRenderer.invoke('pet:get-bootstrap'),
  onState: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('pet:state', listener);
    return () => ipcRenderer.removeListener('pet:state', listener);
  },
  onToast: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('pet:toast', listener);
    return () => ipcRenderer.removeListener('pet:toast', listener);
  },
  drag: (dx, dy) => ipcRenderer.send('pet:drag', { dx, dy }),
  setClickThrough: (value) => ipcRenderer.send('pet:set-click-through', value),
});
