# How to Test the Extension

## Before You Start

- [ ] Extension loaded in Chrome (`chrome://extensions/` → Load unpacked → select `ciazam`)
- [ ] Icons in place: `icons/icon16.png`, `icon48.png`, `icon128.png`
- [ ] **AI proxy running**: `cd ai-proxy && npm start` (needed for AI commands and image analysis)
- [ ] `ai-proxy/.env` has `GEMINI_API_KEY=your_key`
- [ ] You're on a normal webpage (not `chrome://` or New Tab)

---

## Quick Test (about 2 minutes)

1. **Open the popup** – Click the extension icon.
2. **Microphone** – Click **Start Listening**. Allow mic if Chrome asks. Say "scroll down".
   - You should see the transcript and the page should scroll. Status shows "Scrolling down".
3. **Fallback (no proxy)** – If the proxy is stopped, say "open google". Fallback should still open Google.
4. **With proxy** – Start the proxy again. Say "open youtube" or "read this page" and confirm the action runs and you get feedback (and TTS if enabled).

**Image Explainer**

1. Click the extension icon → scroll to **Image Explainer**.
2. Click **Upload Image** and pick an image, or **Capture Screen** and capture.
3. Click **Analyze Image**. You should see a description and any extracted text (proxy must be running and `GEMINI_API_KEY` set).

---

## Step-by-Step Tests

### 1. Extension load

- Go to `chrome://extensions/`.
- Find "AI Voice Assistant - Accessibility Extension" (or the name in your manifest).
- No red errors; toggle ON. Click the icon → popup opens with voice section, settings, and Image Explainer.

### 2. Microphone and transcript

1. Click extension icon → **Start Listening**.
2. Status: "Listening..." (e.g. orange). Say "hello".
3. Your words appear under "Your command". Status goes to "Processing..." then "Ready".

If nothing appears, allow the microphone when Chrome prompts, or check site settings for the extension.

### 3. Voice commands (proxy running)

Use a long page (e.g. a Wikipedia article).

| Say | Expected |
|-----|----------|
| "scroll down" | Page scrolls down; "Scrolling down" in status |
| "scroll up" | Page scrolls up |
| "go to top" | Page scrolls to top |
| "scroll to bottom" | Page scrolls to bottom |
| "go back" | Browser goes back |
| "go forward" | Browser goes forward |
| "refresh" | Page reloads |
| "open google" | New tab with Google |
| "open youtube.com" | New tab with YouTube |
| "read this page" | Page content read (and spoken if TTS on) |
| "describe the page" | Short visual description of the page |
| "click Submit" (or a real button label) | That element is clicked |

Natural phrasing should also work (e.g. "can you scroll down?", "please go back").

### 4. Fallback (proxy off)

1. Stop the proxy (Ctrl+C in the terminal).
2. Say "open google" or "scroll down".
3. These should still work via the built-in fallback. Other commands may return "Command not recognized" or "UNKNOWN".
4. Restart the proxy for full AI understanding.

### 5. Image Explainer

- **Upload**: Upload Image → choose file → preview appears → **Analyze Image**. You should see description + OCR.
- **Capture**: Capture Screen → allow capture → **Analyze Image**. Same result.
- If it fails: proxy running? `GEMINI_API_KEY` in `ai-proxy/.env`? Check the popup error message.

### 6. TTS (voice feedback)

1. In popup, ensure **Enable voice feedback (TTS)** is checked.
2. Run any command (e.g. "scroll down"). You should hear a short confirmation.
3. Uncheck TTS and run again. No audio.

### 7. Error cases

- **Proxy not running** – Commands that need AI may fail or fall back to UNKNOWN; image analysis will fail with a message about the proxy.
- **Wrong / missing key** – Proxy may return errors; check `ai-proxy` terminal and popup message.
- **Invalid command** – Say something unrelated (e.g. "what's the weather?"). You may get "Command not recognized" or UNKNOWN.
- **chrome:// page** – Actions like scroll/click often won’t work; use a normal site.

---

## Where to Test

- **Wikipedia** – Long text, good for scroll and "read this page".
- **YouTube / Gmail** – Buttons and search for "click" and "search for".
- **Any news or article site** – Read and describe page.

Avoid `chrome://`, New Tab, and sites that block content scripts.

---

## Debugging

- **Popup console**: Right-click popup → Inspect → Console. Look for red errors.
- **Background**: `chrome://extensions/` → your extension → "service worker" (or "Inspect views: background page") → Console.
- **Proxy**: Check the terminal where you ran `npm start` for request/error logs.
- **Mic**: Test at a site that uses voice (e.g. Google voice search); if that works, the issue is likely permission for the extension.

---

## Short checklist

- [ ] Popup opens; Start Listening works; transcript appears.
- [ ] "scroll down" / "open google" run (with or without proxy for fallback).
- [ ] With proxy: "read this page", "describe the page", "click [button]" work.
- [ ] Image upload or capture → Analyze Image returns description/OCR.
- [ ] TTS on/off toggles spoken feedback.
- [ ] No API key in the extension; key only in `ai-proxy/.env`.

If all of the above pass, the extension is working as intended.
