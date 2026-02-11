# Troubleshooting: Voice Function Not Working

## Common Issue: "Error: not-allowed"

This error means Chrome hasn't granted microphone permission to the extension.

## Quick Fix Steps:

### Method 1: Grant Permission via Chrome Settings (Recommended)

1. **Open Chrome Settings**
   - Click the three dots (⋮) in top-right
   - Go to **Settings**
   - Click **Privacy and security** → **Site Settings**
   - Click **Microphone**

2. **Find Your Extension**
   - Look for entries starting with `chrome-extension://`
   - Find the one for "AI Voice Assistant" (or check the extension ID)
   - Set it to **"Allow"**

3. **Refresh Extension**
   - Go back to `chrome://extensions/`
   - Click the refresh icon on your extension
   - Try "Start Listening" again

### Method 2: Grant Permission via Address Bar

1. **Click the Extension Icon** in Chrome toolbar
2. **Look for Permission Prompt**
   - Chrome may show a microphone icon in the address bar
   - Click it and select "Allow"
3. **Try Again**

### Method 3: Check System Microphone Settings

**On macOS:**
- System Settings → Privacy & Security → Microphone
- Make sure Chrome is allowed

**On Windows:**
- Settings → Privacy → Microphone
- Make sure Chrome has microphone access

**On Linux:**
- Check your system's privacy settings
- Ensure Chrome has microphone permissions

## Other Common Issues:

### "No speech detected"
- **Solution**: Speak louder and more clearly
- Make sure your microphone is working (test in other apps)
- Check microphone isn't muted

### "Network error"
- **Solution**: Check your internet connection
- Web Speech API requires internet for some features

### "Audio capture" error
- **Solution**: No microphone detected
- Connect a microphone or check if it's properly connected
- Restart Chrome after connecting

### Extension shows "Service Worker (Inactive)"
- **Solution**: This is normal - service workers are inactive until needed
- Click the extension icon to activate it

## Testing Microphone Access:

1. **Test in Chrome First:**
   - Go to https://www.google.com/search?q=test+microphone
   - Try using voice search
   - If that works, your microphone is fine

2. **Check Extension Console:**
   - Right-click extension popup → Inspect
   - Go to Console tab
   - Look for error messages when clicking "Start Listening"

## Read Page Aloud Not Working

If you don't hear anything when the extension reads pages aloud:

### Quick Test:
The extension uses Chrome's `chrome.tts` API (not Web Speech Synthesis) for read-aloud. Check:

1. **Check Chrome TTS**: Open Chrome DevTools console (F12) and run:
   ```javascript
   chrome.tts.speak("Test", { lang: 'en-US' })
   ```
   If you don't hear "Test", Chrome TTS may not be working.

2. **Check System Audio**: Ensure your system volume is up and audio output device is correct.

### Fixes:

**1. Check macOS System Settings (for chrome.tts):**
- System Settings → **Accessibility** → **Spoken Content**
- Ensure **"Speak selection"** is ON
- Check that **"System voice"** is set (e.g., "Samantha")
- Try changing the voice and test again

**2. Check Chrome Tab Audio:**
- Right-click the tab → Check if "Mute site" is enabled
- If muted, click "Unmute site"
- Check system volume and output device

**3. Check Background Script:**
- Go to `chrome://extensions/`
- Find your extension → Click **"Service worker"** or **"Inspect views: service worker"**
- Check Console for TTS errors
- Look for `[BACKGROUND TTS]` debug messages

**4. Test Read Page Shortcut:**
- Press **Option+Shift+R** (Mac) or **Alt+Shift+R** (Win/Linux)
- This should trigger read-aloud even if popup doesn't work

**5. Check Permissions:**
- Ensure extension has **tts** permission in manifest
- Reload extension if permissions changed

**6. Restart Chrome:**
- Close all Chrome windows completely
- Reopen Chrome
- Try read-aloud again

## Simplified Reading Not Working

If clicking **Simplified Reading** doesn't simplify the page:

**1. Check Console for Errors:**
- Open DevTools (F12) → Console
- Click **Simplified Reading** button
- Look for error messages (e.g., "Could not establish connection", "simplifyPageContent is not defined")

**2. Refresh the Page:**
- Some sites may block content script modifications
- Refresh the page and try again

**3. Check Content Script:**
- Ensure content script is loaded (check Console for `[CONTENT DEBUG]` messages)
- If not loaded, refresh the page

**4. Restore Button Not Working:**
- If "Restore page" button doesn't restore the original page, refresh the page manually
- The original HTML is saved in `window.__simplify_original_html`

## Target Size Controls Not Working

If **Increase/Decrease Target Size** buttons don't work:

**1. Check Console for Errors:**
- Open DevTools (F12) → Console
- Click the buttons and look for errors

**2. Refresh the Page:**
- Content script needs to be loaded
- Refresh the page and try again

**3. Check Content Script:**
- Ensure content script is loaded
- Check Console for `[CONTENT DEBUG]` messages

## Playback Controls Not Working

If pause/resume/fast-forward/rewind/stop buttons don't work:

**1. Check if Reading Started:**
- Buttons only appear when reading is active
- Ensure read-aloud started successfully

**2. Check Background Script:**
- Go to `chrome://extensions/` → **"Service worker"**
- Check Console for `[BACKGROUND TTS]` messages
- Look for errors when clicking buttons

**3. Buttons Disappear:**
- If buttons disappear after clicking, check Console for `readPageEnded` messages
- This might indicate reading stopped unexpectedly

## Still Not Working?

1. **Reload the Extension:**
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension
   - Try again

2. **Check Browser Compatibility:**
   - Make sure you're using Chrome (not Edge, Firefox, etc.)
   - Web Speech API and chrome.tts work best in Chrome

3. **Check Extension Permissions:**
   - In `chrome://extensions/`, click "Details" on your extension
   - Verify all permissions are enabled: **tts**, **tabs**, **scripting**, **activeTab**, **storage**

4. **Try Incognito Mode:**
   - Sometimes extensions work differently in incognito
   - Test if it works there (may need to enable extension in incognito)

5. **Restart Chrome:**
   - Close all Chrome windows
   - Reopen Chrome
   - Try again

## Debug Information:

To get more details about the error:

1. Right-click the extension popup
2. Select "Inspect"
3. Go to Console tab
4. Click "Start Listening"
5. Look for error messages
6. Share these errors if you need more help

## Expected Behavior:

When working correctly:
1. Click "Start Listening"
2. Status changes to "Listening..." (orange dot)
3. Chrome may prompt for microphone permission (first time only)
4. Speak your command
5. Status changes to "Processing..." (blue dot)
6. Command is transcribed and executed
7. Status returns to "Ready to listen" (green dot)

---

**Need More Help?** Check the browser console for specific error messages and share them for troubleshooting.

