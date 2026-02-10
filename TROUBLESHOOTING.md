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

## TTS (Text-to-Speech) Not Working

If you don't hear anything when the extension reads pages aloud:

### Quick Test:
Open the browser console (F12) on any webpage and run:
```javascript
speechSynthesis.speak(new SpeechSynthesisUtterance("Hello, this is a test"))
```
If you don't hear "Hello, this is a test", Chrome's TTS isn't working.

### Fixes:

**1. Check macOS System Settings:**
- System Settings → **Accessibility** → **Spoken Content**
- Ensure **"Speak selection"** is ON
- Check that **"System voice"** is set (e.g., "Samantha")
- Try changing the voice and test again

**2. Check Chrome Tab Audio:**
- Right-click the tab → Check if "Mute site" is enabled
- If muted, click "Unmute site"
- Check system volume and output device

**3. Test System TTS:**
- On macOS: Select some text and press **Option + Esc** (or use Edit → Speech → Start Speaking)
- If system TTS works but Chrome doesn't, it's a Chrome-specific issue

**4. Chrome Flags (if needed):**
- Go to `chrome://flags`
- Search for "speech" or "synthesis"
- Ensure nothing is disabled

**5. Restart Chrome:**
- Close all Chrome windows completely
- Reopen Chrome
- Test TTS again in console

**6. Check Console for Errors:**
- Open DevTools (F12) → Console
- Run the test command above
- Look for any error messages (e.g., "not-allowed", "failed", etc.)

## Still Not Working?

1. **Reload the Extension:**
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension
   - Try again

2. **Check Browser Compatibility:**
   - Make sure you're using Chrome (not Edge, Firefox, etc.)
   - Web Speech API works best in Chrome

3. **Check Extension Permissions:**
   - In `chrome://extensions/`, click "Details" on your extension
   - Verify all permissions are enabled

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

