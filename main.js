
'use strict';

const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  session
} = require('electron');

const path = require('node:path');
const fs = require('node:fs');

const APP_NAME = 'TV Studio';
const TOP_BAR_HEIGHT = 104;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

let mainWindow = null;
let playerView = null;
let playerSession = null;
let currentAppName = '';
let isQuitting = false;

const trustedAppUrls = new Map([
  ['Netflix', 'https://www.netflix.com/'],
  ['YouTube', 'https://www.youtube.com/'],
  ['Prime Video', 'https://www.primevideo.com/'],
  ['JioHotstar', 'https://www.hotstar.com/'],
  ['Sony LIV', 'https://www.sonyliv.com/'],
  ['ZEE5', 'https://www.zee5.com/'],
  ['Sun NXT', 'https://www.sunnxt.com/'],
  ['aha', 'https://www.aha.video/'],
  ['Disney+', 'https://www.disneyplus.com/'],
  ['Spotify', 'https://open.spotify.com/'],
  ['Prime Music', 'https://music.amazon.in/'],
  ['YouTube Music', 'https://music.youtube.com/'],
  ['Browser', 'https://www.google.com/']
]);

function sendPlayerState(state) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send('player-state', state);
}

function isSafeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getPlayerBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const [width, height] = mainWindow.getContentSize();

  const top = Math.min(TOP_BAR_HEIGHT, height);

  return {
    x: 0,
    y: top,
    width: Math.max(0, width),
    height: Math.max(0, height - top)
  };
}

function resizePlayer() {
  if (!playerView || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const bounds = getPlayerBounds();

  if (!bounds) return;

  playerView.setBounds(bounds);
}

function updatePlayerVisibility() {
  if (!playerView || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (playerView.webContents.isDestroyed()) return;

  if (playerView.webContents.getURL()) {
    playerView.setBounds(getPlayerBounds());
  }
}

function getPlayerTitle() {
  if (!playerView || playerView.webContents.isDestroyed()) {
    return currentAppName || APP_NAME;
  }

  return playerView.webContents.getTitle() || currentAppName || APP_NAME;
}

function closePlayer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (playerView) {
    const view = playerView;
    playerView = null;

    try {
      mainWindow.contentView.removeChildView(view);
    } catch (error) {
      console.warn('Could not remove player view:', error.message);
    }

    try {
      if (!view.webContents.isDestroyed()) {
        view.webContents.close({ waitForBeforeUnload: false });
      }
    } catch (error) {
      console.warn('Could not close player contents:', error.message);
    }
  }

  currentAppName = '';

  sendPlayerState({
    status: 'closed',
    appName: '',
    title: APP_NAME,
    canGoBack: false
  });
}

function createPlayerView() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('TV Studio window is unavailable.');
  }

  if (playerView && !playerView.webContents.isDestroyed()) {
    return playerView;
  }

  playerSession = session.fromPartition('persist:tv-studio-player');

  playerView = new WebContentsView({
    webPreferences: {
      session: playerSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.contentView.addChildView(playerView);

  resizePlayer();

  const contents = playerView.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeHttpsUrl(url)) {
      shell.openExternal(url).catch((error) => {
        console.error('Could not open external link:', error);
      });
    }

    return { action: 'deny' };
  });

  contents.on('did-start-loading', () => {
    sendPlayerState({
      status: 'loading',
      appName: currentAppName,
      title: getPlayerTitle(),
      canGoBack: contents.navigationHistory.canGoBack()
    });
  });

  contents.on('did-finish-load', () => {
    if (contents.isDestroyed()) return;

    sendPlayerState({
      status: 'loaded',
      appName: currentAppName,
      title: getPlayerTitle(),
      canGoBack: contents.navigationHistory.canGoBack()
    });
  });

  contents.on('page-title-updated', () => {
    sendPlayerState({
      status: 'loaded',
      appName: currentAppName,
      title: getPlayerTitle(),
      canGoBack: contents.navigationHistory.canGoBack()
    });
  });

  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;

    sendPlayerState({
      status: 'error',
      appName: currentAppName,
      title: getPlayerTitle(),
      message: `Unable to load website: ${errorDescription || validatedURL || errorCode}`,
      canGoBack: contents.navigationHistory.canGoBack()
    });
  });

  contents.on('render-process-gone', (_event, details) => {
    sendPlayerState({
      status: 'error',
      appName: currentAppName,
      title: getPlayerTitle(),
      message: `The website renderer stopped (${details.reason}).`,
      canGoBack: false
    });
  });

  contents.on('will-navigate', (event, url) => {
    if (!isSafeHttpsUrl(url)) {
      event.preventDefault();
    }
  });

  contents.on('destroyed', () => {
    if (playerView && playerView.webContents === contents) {
      playerView = null;
      currentAppName = '';
    }
  });

  return playerView;
}

function getChatSettingsPath() {
  return path.join(app.getPath('userData'), 'tv-studio-chat-settings.json');
}

function defaultChatSettings() {
  return {
    apiKey: '',
    model: 'gpt-4o-mini'
  };
}

function loadChatSettings() {
  try {
    const settingsFile = getChatSettingsPath();

    if (!fs.existsSync(settingsFile)) {
      return defaultChatSettings();
    }

    const raw = fs.readFileSync(settingsFile, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      ...defaultChatSettings(),
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    };
  } catch (error) {
    console.warn('Could not load chat settings:', error.message);
    return defaultChatSettings();
  }
}

function saveChatSettings(settings) {
  const normalized = {
    ...defaultChatSettings(),
    ...(settings && typeof settings === 'object' ? settings : {})
  };

  normalized.apiKey = typeof normalized.apiKey === 'string' ? normalized.apiKey.trim() : '';
  normalized.model = typeof normalized.model === 'string' && normalized.model.trim()
    ? normalized.model.trim()
    : 'gpt-4o-mini';

  fs.writeFileSync(getChatSettingsPath(), JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function callOpenAiChatCompletion({ apiKey, model, messages }) {
  const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (!trimmedKey) {
    throw new Error('OpenAI API key is missing. Add it in ChatGPT settings first.');
  }

  const targetModel = typeof model === 'string' && model.trim() ? model.trim() : 'gpt-4o-mini';
  const finalMessages = Array.isArray(messages) ? messages.filter((message) => {
    return message && typeof message === 'object' && typeof message.role === 'string' && typeof message.content === 'string';
  }) : [];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${trimmedKey}`
    },
    body: JSON.stringify({
      model: targetModel,
      temperature: 0.7,
      messages: finalMessages.length ? finalMessages : [{ role: 'user', content: 'Hello' }]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = payload?.error?.message || `OpenAI request failed (${response.status}).`;
    throw new Error(errorMessage);
  }

  const answer = payload?.choices?.[0]?.message?.content;

  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error('OpenAI returned an empty response.');
  }

  return answer.trim();
}

function registerIpcHandlers() {
  ipcMain.removeHandler('open-in-app');
  ipcMain.removeHandler('player-go-back');
  ipcMain.removeHandler('close-in-app');
  ipcMain.removeHandler('open-external');
  ipcMain.removeHandler('toggle-fullscreen');
  ipcMain.removeHandler('get-chat-settings');
  ipcMain.removeHandler('save-chat-settings');
  ipcMain.removeHandler('send-chat-message');

  ipcMain.handle('get-chat-settings', async () => {
    return loadChatSettings();
  });

  ipcMain.handle('save-chat-settings', async (_event, settings) => {
    return saveChatSettings(settings);
  });

  ipcMain.handle('send-chat-message', async (_event, payload) => {
    try {
      const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';

      if (!prompt) {
        return {
          success: false,
          message: 'Please enter a prompt before sending.'
        };
      }

      const settings = loadChatSettings();
      const history = Array.isArray(payload?.history) ? payload.history : [];
      const messages = history
        .filter((message) => message && typeof message === 'object')
        .map((message) => ({
          role: typeof message.role === 'string' ? message.role : 'user',
          content: typeof message.content === 'string' ? message.content : String(message.content || '')
        }))
        .slice(-20);

      messages.push({ role: 'user', content: prompt });

      const answer = await callOpenAiChatCompletion({
        apiKey: settings.apiKey,
        model: settings.model,
        messages
      });

      return {
        success: true,
        answer
      };
    } catch (error) {
      console.error('send-chat-message failed:', error);

      return {
        success: false,
        message: error.message || 'Unable to contact ChatGPT right now.'
      };
    }
  });

  ipcMain.handle('open-in-app', async (_event, requestedUrl) => {
    try {
      if (typeof requestedUrl !== 'string' || !isSafeHttpsUrl(requestedUrl)) {
        return {
          success: false,
          message: 'Only valid HTTPS websites can be opened.'
        };
      }

      const url = new URL(requestedUrl);

      if (!trustedAppUrls.size) {
        return { success: false, message: 'No apps are configured.' };
      }

      const matchedApp = [...trustedAppUrls.entries()].find(([, knownUrl]) => {
        const known = new URL(knownUrl);
        return known.hostname === url.hostname;
      });

      currentAppName = matchedApp ? matchedApp[0] : url.hostname;

      const view = createPlayerView();

      view.setBounds(getPlayerBounds());

      sendPlayerState({
        status: 'opened',
        appName: currentAppName,
        title: currentAppName,
        canGoBack: false
      });

      await view.webContents.loadURL(url.href);

      return { success: true };
    } catch (error) {
      console.error('open-in-app failed:', error);

      return {
        success: false,
        message: error.message || 'Could not open the website.'
      };
    }
  });

  ipcMain.handle('player-go-back', async () => {
    if (!playerView || playerView.webContents.isDestroyed()) {
      return { success: false, message: 'No website is open.' };
    }

    const contents = playerView.webContents;
    const history = contents.navigationHistory;

    if (!history.canGoBack()) {
      return { success: false, message: 'No previous page is available.' };
    }

    history.goBack();

    return { success: true };
  });

  ipcMain.handle('close-in-app', async () => {
    closePlayer();
    return { success: true };
  });

  ipcMain.handle('open-external', async (_event, requestedUrl) => {
    if (typeof requestedUrl !== 'string' || !isSafeHttpsUrl(requestedUrl)) {
      return { success: false, message: 'Invalid external URL.' };
    }

    try {
      await shell.openExternal(requestedUrl);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('toggle-fullscreen', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false };
    }

    mainWindow.setFullScreen(!mainWindow.isFullScreen());

    return {
      success: true,
      fullscreen: mainWindow.isFullScreen()
    };
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    backgroundColor: '#090b12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('resize', resizePlayer);
  mainWindow.on('maximize', resizePlayer);
  mainWindow.on('unmaximize', resizePlayer);
  mainWindow.on('enter-full-screen', resizePlayer);
  mainWindow.on('leave-full-screen', resizePlayer);

  mainWindow.on('close', () => {
    closePlayer();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    playerView = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    resizePlayer();
    updatePlayerVisibility();
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('TV Studio renderer exited:', details.reason);
  });
}

app.whenReady().then(() => {
  app.setName(APP_NAME);

  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  closePlayer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
