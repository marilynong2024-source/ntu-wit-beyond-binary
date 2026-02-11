# 🎤 AI Voice Assistant – Chrome Extension 

An accessible Chrome extension for voice-controlled web browsing. Uses AI (Google Gemini via a local proxy) to understand spoken or typed commands and control the browser. Includes an **Image Explainer** for descriptions and text extraction (OCR). Built for accessibility.

## ✨ Features

- **Voice input (STT)** – Web Speech API in the **content script** (page context) for reliable recognition; start from the popup’s **Start Listening** button.
- **AI command understanding** – Natural language → browser actions via Gemini (local ai-proxy). When the proxy is unavailable, a built-in **fallback** handles common phrases.
- **Action execution** – Scroll, click, open URLs, search, back/forward, refresh, **read page aloud** (TTS in background), describe page.
- **Voice feedback (TTS)** – Optional spoken confirmations; **read page** uses Chrome’s `chrome.tts` in the background for reliable playback.
- **Keyboard shortcuts** – **Option+Shift+A** (activate assistant), **Option+Shift+R** (read page aloud), **Option+Shift+S** (stop reading).
- **Image Explainer** – Upload or capture an image; get AI description and OCR (Gemini Vision via ai-proxy).

### Supported commands

| Category | Examples |
|----------|----------|
| **Navigation** | "scroll down", "scroll up", "go to top", "go to bottom" |
| **Browser** | "go back", "go forward", "refresh" |
| **Interactions** | "click Submit", "click the login button" |
| **Content** | "read this page", "read aloud", "read the page", "describe the page" |
| **Search** | "search for cats", "google weather" |
| **Open site** | "open google", "open youtube.com", "open wikipedia.org" |

When the proxy is unavailable, the built-in fallback handles common phrases (e.g. "open google", "scroll down", "go back", "read this page").

## 🚀 Installation

### Prerequisites

1. **Chrome** (version 88+)
2. **Node.js** (for the ai-proxy, e.g. 18+)
3. **Google Gemini API key** – [Create one](https://aistudio.google.com/apikey) (used only by the proxy)

### 1. Extension

1. Clone or download this repo:
   ```bash
   git clone <repository-url>
   cd <project-folder>
   ```
   Replace `<project-folder>` with the name of the cloned directory (e.g. `ntu-wit-beyond-binary`).

2. **Icons** – Ensure these exist in `icons/`:
   - `icons/icon16.png` (16×16)
   - `icons/icon48.png` (48×48)
   - `icons/icon128.png` (128×128)

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Turn on **Developer mode**
   - Click **Load unpacked** and select the **project root folder** (the one containing `manifest.json`)

### 2. AI proxy (required for AI commands and image analysis)

1. Go to the proxy directory:
   ```bash
   cd ai-proxy
   ```

2. Create a `.env` file with your Gemini API key:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```

3. Install and start:
   ```bash
   npm install
   npm start
   ```
   The proxy runs at `http://localhost:3000` by default. Keep it running while using the extension.

### 3. Microphone (for voice)

- When you first click **Start Listening**, Chrome will ask for microphone access; choose **Allow**.

## 🎮 How to use

### Voice commands

1. Open a **normal webpage** (e.g. google.com). Voice recognition runs in the page context; `chrome://` and extension pages are not supported.
2. Click the extension icon, then **Start Listening** (or use **Option+Shift+A** to activate the assistant first).
3. Say a command (e.g. "scroll down", "open google", "read this page").
4. The extension runs the action on the current tab and can speak back (if TTS is on). **Read page** is spoken via the background (Chrome TTS).

**Keyboard shortcuts (any focused tab):**

| Shortcut | Action |
|----------|--------|
| **Option+Shift+A** (Mac) / **Alt+Shift+A** (Win/Linux) | Activate assistant (speaks confirmation) |
| **Option+Shift+R** / **Alt+Shift+R** | Read page aloud |
| **Option+Shift+S** / **Alt+Shift+S** | Stop reading |

### Image Explainer

1. Click the extension icon and scroll to **Image Explainer**.
2. **Upload Image** – choose a file, or **Capture Screen** – use camera/screen capture.
3. Click **Analyze Image**.
4. View the description and any extracted text.

Image analysis goes through the proxy; ensure it’s running and `GEMINI_API_KEY` is set in `ai-proxy/.env`.

### Settings (popup)

- **Enable voice feedback (TTS)** – Turn spoken confirmations on or off.
- **Continuous listening** – After each command, automatically start listening again (optional).

## 🏗️ Architecture

### Layout

```
<project-root>/
├── manifest.json           # Extension manifest (permissions: tts, tabs, scripting, activeTab, storage)
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js            # UI, message to content/background, image upload/capture
├── scripts/
│   ├── background.js       # Service worker: EXECUTE_COMMAND, AI_PARSE, read_page TTS, keyboard commands
│   └── content.js          # Injected script: speech recognition, scroll, click, read page text, etc.
├── utils/
│   └── commands.js         # mapParsedToInternal, fallbackParse (used by background)
├── icons/
│   └── icon16.png, icon48.png, icon128.png
└── ai-proxy/               # Local Node server (Gemini)
    ├── server.js           # POST /parse, POST /vision
    ├── package.json
    └── .env                # GEMINI_API_KEY (create this)
```

### Flow

1. **Start Listening** (popup) → Popup sends `startSpeechRecognition` to the **content script** on the active tab. Content script runs Web Speech API and returns transcript (or handles simple commands locally).
2. **Transcript** → Popup sends `EXECUTE_COMMAND` (with fallback-parsed command) or `AI_PARSE_COMMAND` → background; background may call ai-proxy for AI parsing, then runs the mapped command.
3. **Read page** → Background sends `executeAction`/`read_page` to content; content returns page text; background uses `chrome.tts` to speak it.
4. **Other actions** → Background forwards to content script (`executeAction`) or handles in background (e.g. tab navigation).
5. **Feedback** → Optional TTS in popup; read-page TTS in background.

**Image analysis:** Popup sends image to background → proxy `POST /vision` (Gemini) → description + OCR shown in popup.

### APIs

- **Google Gemini** (via ai-proxy): command parsing (`/parse`), image analysis (`/vision`).
- **Web Speech API**: speech recognition and synthesis (no key).

## 🔧 Configuration

- **Proxy URL** – The ai-proxy runs at `http://localhost:3000` by default. If you run it elsewhere, update the URL where the extension calls the proxy (e.g. in `scripts/background.js` or the code that sends requests to `/parse` or `/vision`).
- **Gemini key** – Only in `ai-proxy/.env`; the extension never sees the key.

### Permissions

- `tts` – Read page aloud from the background.
- `activeTab`, `tabs`, `storage`, `scripting` – core extension, tab control, and settings/history.
- `host_permissions` – for proxy and general web access.
- Optional: `desktopCapture` – for Image Explainer screen capture in the popup.

## 🧪 Testing

- Use on normal web pages (e.g. Wikipedia, Gmail, news sites). `chrome://` pages are not supported.
- Try: "scroll down", "go back", "open google", "read this page", "click [button label]".
- For image analysis, start the proxy and use **Analyze Image** after uploading or capturing.

## 🐛 Troubleshooting

| Issue | What to check |
|-------|----------------|
| **Commands do nothing or "UNKNOWN"** | Proxy running? `npm start` in `ai-proxy`. Check that the extension uses the correct proxy URL. |
| **Image analysis fails** | Proxy running? `GEMINI_API_KEY` in `ai-proxy/.env`? Popup message often suggests checking proxy and key. |
| **No voice recognition / Start Listening does nothing** | Open a normal webpage (not `chrome://`). Refresh the page and try again. Allow microphone when prompted. Check that the extension has the **storage** permission (reload extension after updating). |
| **Actions don’t run on page** | Are you on a normal webpage? Some sites restrict or block content scripts. |

## 🔒 Privacy and security

- **Gemini API key** – Stored only in `ai-proxy/.env` on your machine; the extension does not read it.
- **Voice** – Processed by the browser’s Web Speech API (handled by Chrome).
- **Commands and images** – Sent from your browser to your local proxy, then to Google Gemini; not stored by the extension beyond the session.
- **No tracking** – The extension does not track or analytics.

## 📝 License

MIT – use and modify as you like.

## 🎯 Possible improvements

- Wake word ("Hey Assist")
- Multi-language support
- Custom commands
- Offline fallback for simple commands (fallback already covers many phrases)

---

**Built for accessibility and inclusion.**
