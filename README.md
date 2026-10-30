# TV Studio for Windows — starter build

A manually launched, full-screen Smart TV-style desktop interface inspired by the design goals of [CleanYourTV](https://github.com/Gathin23/cleanyourtv). This is a separate Windows UI; it does not install the Android TV launcher or modify a physical TV.

## Included in this MVP
- Dark, TV-inspired home screen with clock and date
- Quick-launch tiles for popular streaming and media services (opens the service in your default browser)
- Keyboard navigation using arrow keys and Enter
- Four ambience themes
- Help dialog and responsive layout
- Electron context isolation, preload bridge, and restricted external URL handling
- Manual launch; no startup registration or background service

## Requirements
- Windows 10/11, 64-bit recommended
- Node.js LTS and npm

## Run in development
1. Extract this folder.
2. Open PowerShell in this folder.
3. Run:

   ```powershell
   npm install
   npm start
   ```

## Build a Windows installer / portable app

```powershell
npm install
npm run dist
```

Build outputs are written to `release/`. Packaging requires internet access to download npm packages and Electron's Windows binaries.

## Controls
- Arrow keys: move between app tiles
- Enter: open selected shortcut
- F11: toggle full screen
- H: open help
- Esc: close dialog / leave full screen depending on context

## Current limitations
- This is a UI starter, not a replacement operating system or Android TV.
- Streaming services open in the default browser; the app does not include subscriptions, DRM playback, or their native clients.
- The media library is a placeholder for the next milestone.
- The first build has not been run or packaged on your particular Windows machine yet.

## Next milestones
1. Wire a real Electron fullscreen toggle and TV-mode setting.
2. Add editable favourites and tile ordering with local persistence.
3. Add local media library browsing and safe playback options.
4. Add a proper Windows build pipeline and smoke tests.
5. Add optional remote-control input support.
