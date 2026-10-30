
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tvStudio', {
  // Open a streaming website inside TV Studio.
  openInApp: (url) => ipcRenderer.invoke('open-in-app', url),

  // Navigate back inside the currently open streaming website.
  goBack: () => ipcRenderer.invoke('player-go-back'),

  // Close the streaming website and return to the TV Studio home screen.
  closeInApp: () => ipcRenderer.invoke('close-in-app'),

  // Open a link using the computer's default browser.
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Toggle fullscreen mode.
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // Load and save the ChatGPT settings.
  getChatSettings: () => ipcRenderer.invoke('get-chat-settings'),
  saveChatSettings: (settings) => ipcRenderer.invoke('save-chat-settings', settings),
  sendChatMessage: (payload) => ipcRenderer.invoke('send-chat-message', payload),

  // Listen for loading, error, and player open/close updates.
  onPlayerState: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, state) => {
      callback(state);
    };

    ipcRenderer.on('player-state', listener);

    // Return a cleanup function to remove the listener when needed.
    return () => {
      ipcRenderer.removeListener('player-state', listener);
    };
  }
});
