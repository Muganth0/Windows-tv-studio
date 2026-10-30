
'use strict';

/* ==========================================
   TV STUDIO — RENDERER
   ========================================== */

const $ = (selector) => document.querySelector(selector);

const homeScreen = $('#homeScreen');
const appGrid = $('#appGrid');
const playerControls = $('#playerControls');
const backBtn = $('#backBtn');
const closeInAppBtn = $('#closeInAppBtn');
const playerStatus = $('#playerStatus');

const clock = $('#clock');
const dateLabel = $('#dateLabel');
const fullDate = $('#fullDate');

const locationLabel = $('#locationLabel');
const weatherCity = $('#weatherCity');
const refreshWeather = $('#refreshWeather');
const weatherIcon = $('#weatherIcon');
const temperature = $('#temperature');
const weatherDescription = $('#weatherDescription');
const humidity = $('#humidity');
const windSpeed = $('#windSpeed');
const weatherStatus = $('#weatherStatus');

const browseBtn = $('#browseBtn');
const helpBtn = $('#helpBtn');
const chatBtn = $('#chatBtn');
const themeBtn = $('#themeBtn');
const fullscreenBtn = $('#fullscreenBtn');

const chatModal = $('#chatModal');
const chatCloseBtn = $('#chatCloseBtn');
const chatApiKeyInput = $('#chatApiKey');
const chatModelSelect = $('#chatModel');
const chatSaveBtn = $('#chatSaveBtn');
const chatForm = $('#chatForm');
const chatInput = $('#chatInput');
const chatSendBtn = $('#chatSendBtn');
const chatMessages = $('#chatMessages');
const chatStatus = $('#chatStatus');

const modal = $('#modal');
const modalTitle = $('#modalTitle');
const modalText = $('#modalText');
const closeModal = $('#closeModal');
const modalOk = $('#modalOk');

const toast = $('#toast');

let playerIsOpen = false;
let toastTimeout = null;
let weatherRefreshInProgress = false;
let lastWeatherRequest = 0;
let lastFocusedElement = null;

/* ==========================================
   SAFE UI HELPERS
   ========================================== */

function showToast(message, duration = 2800) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('visible');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, duration);
}

function showModal(title, message) {
  if (!modal) return;

  lastFocusedElement = document.activeElement;

  modalTitle.textContent = title;
  modalText.textContent = message;
  modal.hidden = false;

  modalOk?.focus();
}

function hideModal() {
  if (!modal) return;

  modal.hidden = true;

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

function setPlayerStatus(message) {
  if (playerStatus) {
    playerStatus.textContent = message;
  }
}

function setPlayerControlsVisible(visible) {
  if (playerControls) {
    playerControls.hidden = !visible;
  }
}

let chatConversation = [];

function renderChatMessages() {
  if (!chatMessages) return;

  chatMessages.replaceChildren();

  if (!chatConversation.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chat-empty';
    placeholder.textContent = 'Ask for a summary, a recipe, or help planning your day.';
    chatMessages.appendChild(placeholder);
    return;
  }

  chatConversation.forEach((message) => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${message.role}`;

    const label = document.createElement('div');
    label.className = 'chat-label';
    label.textContent = message.role === 'assistant' ? 'ChatGPT' : 'You';

    const content = document.createElement('div');
    content.className = 'chat-text';
    content.textContent = message.content;

    bubble.appendChild(label);
    bubble.appendChild(content);
    chatMessages.appendChild(bubble);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadChatSettingsIntoForm() {
  if (!window.tvStudio) return;

  try {
    const settings = await window.tvStudio.getChatSettings();

    if (chatApiKeyInput) {
      chatApiKeyInput.value = settings?.apiKey || '';
    }

    if (chatModelSelect) {
      chatModelSelect.value = settings?.model || 'gpt-4o-mini';
    }
  } catch (error) {
    console.error('Unable to load chat settings:', error);
  }
}

async function saveChatSettings() {
  if (!window.tvStudio) return;

  const apiKey = chatApiKeyInput?.value.trim() || '';
  const model = chatModelSelect?.value || 'gpt-4o-mini';

  try {
    await window.tvStudio.saveChatSettings({ apiKey, model });
    showToast('ChatGPT settings saved.');
  } catch (error) {
    console.error('Unable to save chat settings:', error);
    showToast('Unable to save chat settings.');
  }
}

async function openChatModal() {
  if (!chatModal) return;

  await loadChatSettingsIntoForm();
  renderChatMessages();
  chatModal.hidden = false;
  chatInput?.focus();
}

function closeChatModal() {
  if (!chatModal) return;
  chatModal.hidden = true;
}

async function handleChatSubmit(event) {
  event.preventDefault();

  if (!chatInput || !window.tvStudio) return;

  const prompt = chatInput.value.trim();

  if (!prompt) {
    chatInput.focus();
    return;
  }

  if (!chatApiKeyInput?.value.trim()) {
    showToast('Please enter your OpenAI API key first.');
    chatApiKeyInput?.focus();
    return;
  }

  const userMessage = { role: 'user', content: prompt };
  chatConversation.push(userMessage);
  renderChatMessages();

  chatInput.value = '';
  chatInput.disabled = true;
  chatSendBtn.disabled = true;

  if (chatStatus) {
    chatStatus.textContent = 'Thinking...';
  }

  try {
    const result = await window.tvStudio.sendChatMessage({
      prompt,
      history: chatConversation.slice(-20)
    });

    if (result && result.success === false) {
      throw new Error(result.message || 'Could not contact ChatGPT.');
    }

    const reply = result?.answer || 'No response was returned.';
    chatConversation.push({ role: 'assistant', content: reply });
    renderChatMessages();

    if (chatStatus) {
      chatStatus.textContent = 'Ready';
    }
  } catch (error) {
    console.error('Chat request failed:', error);
    showToast(error.message || 'Unable to contact ChatGPT.');

    if (chatStatus) {
      chatStatus.textContent = 'Error';
    }
  } finally {
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

/* ==========================================
   CLOCK AND DATE
   ========================================== */

function updateClock() {
  const now = new Date();

  if (clock) {
    clock.textContent = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(now);
  }

  if (dateLabel) {
    dateLabel.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(now);
  }

  if (fullDate) {
    fullDate.textContent = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(now);
  }
}

updateClock();
setInterval(updateClock, 1000);

/* ==========================================
   STREAMING APP NAVIGATION
   ========================================== */

async function openApp(button) {
  if (!button || !window.tvStudio) {
    showToast('TV Studio bridge is unavailable.');
    return;
  }

  const appName = button.dataset.app;
  const url = button.dataset.url;

  if (!appName || !url) {
    showToast('This app does not have a valid address.');
    return;
  }

  // Restrict app launches to HTTPS websites.
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    showToast('Invalid website address.');
    return;
  }

  if (parsedUrl.protocol !== 'https:') {
    showToast('Only secure HTTPS websites are supported.');
    return;
  }

  setPlayerStatus(`Opening ${appName}...`);
  setPlayerControlsVisible(true);

  try {
    const result = await window.tvStudio.openInApp(parsedUrl.href);

    if (result && result.success === false) {
      setPlayerStatus('Could not open website');
      showToast(result.message || `Unable to open ${appName}.`);
      return;
    }

    playerIsOpen = true;
    setPlayerStatus(appName);
  } catch (error) {
    console.error('Unable to open app:', error);
    setPlayerStatus('Unable to open website');
    showToast(`Could not open ${appName}. Check main.js.`);
  }
}

appGrid?.querySelectorAll('.app-card').forEach((button) => {
  button.addEventListener('click', () => {
    openApp(button);
  });
});

/* ==========================================
   BACK AND CLOSE BUTTONS
   ========================================== */

async function goBack() {
  if (!window.tvStudio) return;

  try {
    const result = await window.tvStudio.goBack();

    if (result && result.success === false) {
      showToast(result.message || 'No previous page is available.');
    }
  } catch (error) {
    console.error('Back navigation failed:', error);
    showToast('Unable to navigate back.');
  }
}

async function closeInApp() {
  if (!window.tvStudio) return;

  try {
    const result = await window.tvStudio.closeInApp();

    if (result && result.success === false) {
      showToast(result.message || 'Unable to return home.');
      return;
    }

    playerIsOpen = false;
    setPlayerControlsVisible(false);
    setPlayerStatus('Ready');
  } catch (error) {
    console.error('Unable to close in-app website:', error);
    showToast('Unable to return to the home screen.');
  }
}

backBtn?.addEventListener('click', goBack);
closeInAppBtn?.addEventListener('click', closeInApp);

/* ==========================================
   PLAYER STATE FROM MAIN PROCESS
   ========================================== */

if (window.tvStudio?.onPlayerState) {
  window.tvStudio.onPlayerState((state) => {
    if (!state || typeof state !== 'object') return;

    if (state.status === 'opened') {
      playerIsOpen = true;
      setPlayerControlsVisible(true);
      setPlayerStatus(state.appName || state.title || 'Playing');
    }

    if (state.status === 'loading') {
      setPlayerControlsVisible(true);
      setPlayerStatus(state.appName
        ? `Loading ${state.appName}...`
        : 'Loading website...');
    }

    if (state.status === 'loaded') {
      setPlayerControlsVisible(true);
      setPlayerStatus(state.title || state.appName || 'Ready');
    }

    if (state.status === 'closed') {
      playerIsOpen = false;
      setPlayerControlsVisible(false);
      setPlayerStatus('Ready');
    }

    if (state.status === 'error') {
      setPlayerControlsVisible(true);
      setPlayerStatus('Website error');

      if (state.message) {
        showToast(state.message, 4000);
      }
    }

    if (typeof state.canGoBack === 'boolean' && backBtn) {
      backBtn.disabled = !state.canGoBack;
    }
  });
}

/* ==========================================
   THEME SWITCH
   ========================================== */

chatBtn?.addEventListener('click', openChatModal);
chatCloseBtn?.addEventListener('click', closeChatModal);
chatSaveBtn?.addEventListener('click', saveChatSettings);
chatForm?.addEventListener('submit', handleChatSubmit);
chatModal?.addEventListener('click', (event) => {
  if (event.target === chatModal) {
    closeChatModal();
  }
});

themeBtn?.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');

  themeBtn.textContent = isLight ? '☾' : '◐';
  themeBtn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
  themeBtn.setAttribute(
    'aria-label',
    isLight ? 'Switch to dark theme' : 'Switch to light theme'
  );
});

/* ==========================================
   FULLSCREEN
   ========================================== */

fullscreenBtn?.addEventListener('click', async () => {
  if (!window.tvStudio) {
    showToast('Fullscreen controls are unavailable.');
    return;
  }

  try {
    await window.tvStudio.toggleFullscreen();
  } catch (error) {
    console.error('Fullscreen toggle failed:', error);
    showToast('Unable to change fullscreen mode.');
  }
});

/* ==========================================
   BROWSE AND HELP
   ========================================== */

browseBtn?.addEventListener('click', () => {
  $('#appsSection')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  const firstApp = appGrid?.querySelector('.app-card');
  firstApp?.focus({ preventScroll: true });
});

helpBtn?.addEventListener('click', () => {
  showModal(
    'How to use TV Studio',
    'Select an app card to open its website inside TV Studio. Use Back to revisit the previous page and Close to return to the home screen. Use the theme button to switch appearance and the fullscreen button for a larger view. Some streaming services may require you to sign in or may restrict playback in embedded browser windows.'
  );
});

closeModal?.addEventListener('click', hideModal);
modalOk?.addEventListener('click', hideModal);

modal?.addEventListener('click', (event) => {
  if (event.target === modal) {
    hideModal();
  }
});

/* ==========================================
   KEYBOARD NAVIGATION
   ========================================== */

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (modal && !modal.hidden) {
      hideModal();
      return;
    }

    if (playerIsOpen) {
      event.preventDefault();
      closeInApp();
    }

    return;
  }

  if (event.key === 'Backspace') {
    const target = event.target;
    const isTypingField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;

    if (!isTypingField && playerIsOpen) {
      event.preventDefault();
      goBack();
    }

    return;
  }

  // Use arrow keys to move between app cards.
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    return;
  }

  if (modal && !modal.hidden) return;

  const cards = Array.from(
    appGrid?.querySelectorAll('.app-card') || []
  );

  const currentIndex = cards.indexOf(document.activeElement);

  if (currentIndex < 0) return;

  const columns = getComputedStyle(appGrid).gridTemplateColumns
    .split(' ')
    .filter(Boolean).length || 1;

  let nextIndex = currentIndex;

  if (event.key === 'ArrowLeft') nextIndex--;
  if (event.key === 'ArrowRight') nextIndex++;
  if (event.key === 'ArrowUp') nextIndex -= columns;
  if (event.key === 'ArrowDown') nextIndex += columns;

  if (nextIndex >= 0 && nextIndex < cards.length) {
    event.preventDefault();
    cards[nextIndex].focus();
  }
});

/* ==========================================
   WEATHER
   Uses Open-Meteo public endpoints.
   Approximate location is based on IP.
   ========================================== */

const WEATHER_CODE_INFO = {
  0: ['Clear sky', '☀'],
  1: ['Mainly clear', '🌤'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁'],
  45: ['Fog', '🌫'],
  48: ['Depositing rime fog', '🌫'],
  51: ['Light drizzle', '🌦'],
  53: ['Moderate drizzle', '🌦'],
  55: ['Dense drizzle', '🌧'],
  56: ['Light freezing drizzle', '🌧'],
  57: ['Dense freezing drizzle', '🌧'],
  61: ['Slight rain', '🌦'],
  63: ['Moderate rain', '🌧'],
  65: ['Heavy rain', '🌧'],
  66: ['Light freezing rain', '🌧'],
  67: ['Heavy freezing rain', '🌧'],
  71: ['Slight snowfall', '🌨'],
  73: ['Moderate snowfall', '🌨'],
  75: ['Heavy snowfall', '❄'],
  77: ['Snow grains', '🌨'],
  80: ['Slight rain showers', '🌦'],
  81: ['Moderate rain showers', '🌧'],
  82: ['Violent rain showers', '⛈'],
  85: ['Snow showers', '🌨'],
  86: ['Heavy snow showers', '❄'],
  95: ['Thunderstorm', '⛈'],
  96: ['Thunderstorm with hail', '⛈'],
  99: ['Severe thunderstorm with hail', '⛈']
};

function weatherCodeInfo(code) {
  return WEATHER_CODE_INFO[code] || ['Weather unavailable', '☁'];
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function setWeatherUnavailable(message) {
  if (temperature) temperature.textContent = '--°';
  if (weatherIcon) weatherIcon.textContent = '☁';
  if (weatherDescription) weatherDescription.textContent = 'Unavailable';
  if (humidity) humidity.textContent = '--';
  if (windSpeed) windSpeed.textContent = '--';
  if (weatherStatus) weatherStatus.textContent = message;
}

async function loadWeather(force = false) {
  if (weatherRefreshInProgress) return;

  const now = Date.now();

  if (!force && now - lastWeatherRequest < 5 * 60 * 1000) {
    return;
  }

  weatherRefreshInProgress = true;
  lastWeatherRequest = now;

  if (weatherStatus) {
    weatherStatus.textContent = 'Loading current weather...';
  }

  if (refreshWeather) {
    refreshWeather.disabled = true;
    refreshWeather.textContent = '…';
  }

  try {
    // IP-based geolocation is approximate and may not identify
    // the user's exact town or physical location.
    const locationData = await fetchJson('https://ipwho.is/');

    if (locationData.success === false) {
      throw new Error('Approximate location is unavailable.');
    }

    const latitude = Number(locationData.latitude);
    const longitude = Number(locationData.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Location coordinates are unavailable.');
    }

    const city = locationData.city || 'Current area';
    const region = locationData.region || '';

    const locationText = [city, region]
      .filter(Boolean)
      .join(', ');

    if (locationLabel) {
      locationLabel.textContent = locationText;
      locationLabel.title = locationText;
    }

    if (weatherCity) {
      weatherCity.textContent = locationText;
    }

    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');

    weatherUrl.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
      timezone: 'auto'
    }).toString();

    const weatherData = await fetchJson(weatherUrl.toString());
    const current = weatherData.current;

    if (!current) {
      throw new Error('Current weather data is unavailable.');
    }

    const code = Number(current.weather_code);
    const [description, icon] = weatherCodeInfo(code);

    if (temperature) {
      temperature.textContent =
        `${Math.round(Number(current.temperature_2m))}°`;
    }

    if (weatherIcon) {
      weatherIcon.textContent =
        code === 0 && Number(current.is_day) === 0 ? '🌙' : icon;
    }

    if (weatherDescription) {
      weatherDescription.textContent = description;
    }

    if (humidity) {
      humidity.textContent =
        `${Math.round(Number(current.relative_humidity_2m))}%`;
    }

    if (windSpeed) {
      windSpeed.textContent =
        `${Math.round(Number(current.wind_speed_10m))} km/h`;
    }

    if (weatherStatus) {
      weatherStatus.textContent =
        `Feels like ${Math.round(Number(current.apparent_temperature))}° · Updated just now`;
    }
  } catch (error) {
    console.warn('Weather could not be loaded:', error);

    if (weatherStatus) {
      weatherStatus.textContent =
        'Weather unavailable. Check your internet connection and retry.';
    }

    if (locationLabel && locationLabel.textContent === 'Detecting location...') {
      locationLabel.textContent = 'Location unavailable';
    }

    setWeatherUnavailable(
      'Could not retrieve weather information.'
    );
  } finally {
    weatherRefreshInProgress = false;

    if (refreshWeather) {
      refreshWeather.disabled = false;
      refreshWeather.textContent = '↻';
    }
  }
}

refreshWeather?.addEventListener('click', () => {
  lastWeatherRequest = 0;
  loadWeather(true);
});

// Load weather when the dashboard starts.
loadWeather();

// Refresh periodically.
setInterval(() => {
  lastWeatherRequest = 0;
  loadWeather(true);
}, 15 * 60 * 1000);

/* ==========================================
   INITIAL STATE
   ========================================== */

setPlayerControlsVisible(false);
setPlayerStatus('Ready');

console.log('TV Studio renderer initialized.');
