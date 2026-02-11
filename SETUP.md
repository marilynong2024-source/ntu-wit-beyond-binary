# Quick Setup Guide

This guide gets the **AI Voice Assistant** Chrome extension and its **ai-proxy** (Gemini) running on your machine.

## Step 1: Create Icons

Before loading the extension, create icon files in `icons/`:

### Option A: Use Online Tool (Easiest)
1. Go to https://www.favicon-generator.org/
2. Upload any image (e.g. a microphone icon or emoji screenshot)
3. Download the generated icons
4. Rename and place them:
   - `favicon-16x16.png` → `icons/icon16.png`
   - `favicon-32x32.png` → `icons/icon48.png` (or resize)
   - `favicon-96x96.png` → `icons/icon128.png` (or resize)

### Option B: Create Simple Icons
1. Create a 128×128 pixel image (e.g. microphone icon)
2. Resize and save:
   - 128×128 → `icons/icon128.png`
   - 48×48 → `icons/icon48.png`
   - 16×16 → `icons/icon16.png`

### Option C: Placeholder (For Testing)
- Use the same image for all three; Chrome will scale. Minimum 16×16 pixels.

---

## Step 2: Set Up the AI Proxy

The extension talks to a **local proxy** that uses **Google Gemini**. You need the proxy running for AI commands.

1. **Get a Gemini API key**
   - Go to https://aistudio.google.com/apikey
   - Sign in and create an API key
   - Copy the key

2. **Configure the proxy**
   ```bash
   cd ai-proxy
   ```
   Create a `.env` file in `ai-proxy/` with:
   ```
   GEMINI_API_KEY=your_key_here
   ```
   Replace `your_key_here` with your actual key.

3. **Install and start**
   ```bash
   npm install
   npm start
   ```
   The proxy runs at `http://localhost:3000`. Leave this terminal open while using the extension.

---

## Step 3: Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the **project root folder** (the folder that contains `manifest.json`, e.g. `ntu-wit-beyond-binary`)
5. The extension should appear in your list. It requests: **tts**, **tabs**, **scripting**, **activeTab**, **storage** (and optional **desktopCapture**).

---

## Step 4: First Use

1. **Open a normal webpage** (e.g. google.com). Voice recognition runs in the page; it does not work on `chrome://` or the New Tab page.
2. Click the extension icon in the toolbar.
3. **Microphone**: When you click **Start Listening**, Chrome may ask for microphone access; click **Allow**.
4. **Proxy**: For full AI command parsing, run the ai-proxy (`npm start` in `ai-proxy`). Without it, the built-in fallback still handles many commands (e.g. "open google", "scroll down", "read this page").
5. Say a command (e.g. "scroll down", "open google", "read this page") and check that the action runs and you hear/see the response.

**Keyboard shortcuts (from any tab):**

- **Option+Shift+A** (Mac) / **Alt+Shift+A** (Win/Linux) – Activate assistant
- **Option+Shift+R** / **Alt+Shift+R** – Read page aloud
- **Option+Shift+S** / **Alt+Shift+S** – Stop reading

No API key is entered in the extension; the key lives only in `ai-proxy/.env`.

---

## Troubleshooting

### Icons missing
- Ensure the `icons/` folder exists and contains `icon16.png`, `icon48.png`, `icon128.png`
- Names must match exactly

### Commands not working / "UNKNOWN"
- **Is the proxy running?** In a terminal: `cd ai-proxy && npm start`
- Check that `PROXY_BASE` in `scripts/background.js` is `http://localhost:3000` (or your proxy URL)
- Try a fallback phrase like "open google" or "scroll down" to confirm the extension works


### Microphone not working / Start Listening does nothing
- Use a **normal webpage** (e.g. google.com), not `chrome://` or the extension popup page. Refresh the page and try again.
- Allow microphone when Chrome prompts.
- Check Chrome: Settings → Privacy and security → Site settings → Microphone; allow the extension if listed.
- Ensure the extension has the **storage** permission (see manifest). Reload the extension at `chrome://extensions/` and try again.

### Actions don’t run on the page
- Use a normal webpage (not `chrome://` or the New Tab page).
- Some sites restrict content scripts; try another site.

---

## Testing Checklist

- [ ] Icons in place (`icons/icon16.png`, `icon48.png`, `icon128.png`)
- [ ] Extension loads without errors at `chrome://extensions/` (permissions include **storage** and **tts**)
- [ ] `ai-proxy/.env` has `GEMINI_API_KEY`
- [ ] Proxy starts: `cd ai-proxy && npm start` (optional for fallback commands)
- [ ] On a normal webpage, microphone permission granted when clicking **Start Listening**
- [ ] Transcript appears when you speak; a command runs (e.g. "scroll down", "open google", "read this page")
- [ ] Voice feedback (TTS) works if enabled in popup settings
- [ ] **Option+Shift+R** (or **Alt+Shift+R**) reads the current page aloud
- [ ] **Simplified Reading** button simplifies page layout for easier reading
- [ ] **Target Size** controls increase/decrease click target sizes

---

## Next Steps

- Try more commands (see **README.md** for the full list)
- Test on different sites (e.g. Wikipedia, Gmail)
- Toggle **Enable voice feedback (TTS)** and **Continuous listening** in the popup settings
- Use keyboard shortcuts: **Option+Shift+A**, **Option+Shift+R**, **Option+Shift+S**
- Try accessibility tools: **Simplified Reading** and **Target Size** controls

For more detail and troubleshooting, see **README.md** and **TROUBLESHOOTING.md**.

Happy hacking! 🚀
