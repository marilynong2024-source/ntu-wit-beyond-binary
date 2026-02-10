# 🎤 AI Voice Assistant – Chrome Extension

An accessible Chrome extension for voice-controlled web browsing. Uses AI (Google Gemini via a local proxy) to understand spoken or typed commands and control the browser. Includes an **Image Explainer** for descriptions and text extraction (OCR). Built for accessibility.

## ✨ Features

- **Voice input (STT)** – Web Speech API (browser-native)
- **AI command understanding** – Natural language → browser actions via Gemini (local proxy)
- **Action execution** – Scroll, click, open URLs, search, back/forward, refresh, read page, describe page
- **Voice feedback (TTS)** – Optional spoken confirmation
- **Image Explainer** – Upload or capture an image; get AI description and OCR (Gemini Vision)

### Supported commands

| Category | Examples |
|----------|----------|
| **Navigation** | "scroll down", "scroll up", "go to top", "go to bottom" |
| **Browser** | "go back", "go forward", "refresh" |
| **Interactions** | "click Submit", "click the login button" |
| **Content** | "read this page", "read aloud", "describe the page" |
| **Search** | "search for cats", "google weather" |
| **Open site** | "open google", "open youtube.com", "open wikipedia.org" |

When the proxy is unavailable, a built-in fallback handles common phrases (e.g. "open google", "scroll down", "go back").

## 🚀 Installation

### Prerequisites

1. **Chrome** (version 88+)
2. **Node.js** (for the ai-proxy, e.g. 18+)
3. **Google Gemini API key** – [Create one](https://aistudio.google.com/apikey) (used only by the proxy)

### 1. Extension

1. Clone or download this repo:
   ```bash
   git clone <repository-url>
   cd ciazam
   ```

2. **Icons** – Ensure these exist in `icons/`:
   - `icons/icon16.png` (16×16)
   - `icons/icon48.png` (48×48)
   - `icons/icon128.png` (128×128)

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Turn on **Developer mode**
   - Click **Load unpacked** and select the `ciazam` folder (the one with `manifest.json`)

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

1. Click the extension icon.
2. Click **Start Listening**.
3. Say a command (e.g. "scroll down", "open google", "click Submit").
4. The extension speaks back the action (if TTS is on) and runs it on the current tab.

You can also type in the transcript area and trigger the same flow where supported.

### Image Explainer

1. Click the extension icon and scroll to **Image Explainer**.
2. **Upload Image** – choose a file, or **Capture Screen** – use camera/screen capture.
3. Click **Analyze Image**.
4. View the description and any extracted text.

Image analysis goes through the proxy; ensure it’s running and `GEMINI_API_KEY` is set in `ai-proxy/.env`.

### Settings (popup)

- **Enable voice feedback (TTS)** – Turn spoken confirmations on or off.
- **Enable wake word ("Hey Assist")** – Reserved for future use.

## 🏗️ Architecture

### Layout

```
ciazam/
├── manifest.json           # Extension manifest
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js            # STT, TTS, UI, image upload/capture
├── scripts/
│   ├── background.js       # Service worker: proxy calls, message routing
│   └── content.js          # Injected script: scroll, click, read, etc.
├── utils/
│   └── commands.js         # Command schema, AI prompt, fallback parsing
├── icons/
│   └── icon16.png, icon48.png, icon128.png
└── ai-proxy/               # Local Node server (Gemini)
    ├── server.js           # POST /parse, POST /vision
    ├── package.json
    └── .env                # GEMINI_API_KEY (create this)
```

### Flow

1. **Voice** → Popup (Web Speech API) → transcript.
2. **Transcript** → Background script → proxy `POST /parse` (Gemini) → command JSON.
3. **Command** → Content script (or tab navigation) → action on the page.
4. **Feedback** → Optional TTS in popup.

**Image analysis:** Popup sends image to background → proxy `POST /vision` (Gemini) → description + OCR shown in popup.

### APIs

- **Google Gemini** (via ai-proxy): command parsing (`/parse`), image analysis (`/vision`).
- **Web Speech API**: speech recognition and synthesis (no key).

## 🔧 Configuration

- **Proxy base URL** – In `scripts/background.js`, `PROXY_BASE` defaults to `http://localhost:3000`. Change it if your proxy runs elsewhere.
- **Gemini key** – Only in `ai-proxy/.env`; the extension never sees the key.

### Permissions

- `activeTab`, `tabs`, `storage`, `scripting` – core extension and tab control.
- `host_permissions` – for proxy and general web access.
- Optional: `desktopCapture` – for image capture in the popup.

## 🧪 Testing

- Use on normal web pages (e.g. Wikipedia, Gmail, news sites). `chrome://` pages are not supported.
- Try: "scroll down", "go back", "open google", "read this page", "click [button label]".
- For image analysis, start the proxy and use **Analyze Image** after uploading or capturing.

## 🐛 Troubleshooting

| Issue | What to check |
|-------|----------------|
| **Commands do nothing or "UNKNOWN"** | Proxy running? `npm start` in `ai-proxy`. Correct `PROXY_BASE` in `background.js`. |
| **Image analysis fails** | Proxy running? `GEMINI_API_KEY` in `ai-proxy/.env`? Popup message often suggests checking proxy and key. |
| **No voice recognition** | Microphone allowed for the extension? Using Chrome (not another browser)? |
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
- Keyboard shortcut to open popup or start listening
- Offline fallback for simple commands

---

**Built for accessibility and inclusion.**
