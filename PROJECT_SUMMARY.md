# Project Summary: AI-Powered Voice-Controlled Chrome Extension

## 🎯 Project Overview

A Chrome extension that enables **accessible, voice-controlled web browsing** using AI-powered natural language understanding. Built for the hackathon challenge addressing accessibility barriers for people with visual, auditory, motor, or cognitive impairments.

## ✅ Completed Features

### Core MVP Features (All Implemented):

1. **✅ Speech-to-Text (STT)**
   - Uses Web Speech API (browser-native)
   - Real-time voice recognition
   - Visual feedback with status indicators
   - Error handling for no-speech scenarios

2. **✅ AI Natural Language Understanding (NLU)**
   - Google Gemini integration (via local ai-proxy)
   - Converts natural language to structured actions
   - Fallback pattern matching if proxy unavailable
   - Handles ambiguous commands gracefully

3. **✅ Action Execution**
   - Scroll commands (up, down, top, bottom)
   - Browser navigation (back, forward, refresh)
   - Element clicking by name
   - Page content reading
   - Search functionality
   - Website opening

4. **✅ Text-to-Speech (TTS)**
   - Chrome TTS API (`chrome.tts`) for read page aloud (background script)
   - Web Speech Synthesis API for voice feedback (popup)
   - Configurable on/off toggle
   - Provides audio feedback for all actions
   - Reads page content aloud with pause/resume/fast-forward/rewind controls

5. **✅ Accessibility Tools**
   - **Simplified Reading**: Cleans page layout, optimizes typography (18px font, 1.5 line height, left-aligned), removes ads/navigation
   - **Target Size Controls**: Increase/decrease click target sizes for motor impairments
   - Restore functionality to return to original page view

### Additional Features:

- ✅ Command history tracking
- ✅ Settings panel (TTS toggle, continuous listening)
- ✅ Modern, accessible UI design
- ✅ Status indicators (ready/listening/processing)
- ✅ Error handling and user feedback
- ✅ Fallback mechanisms for API failures
- ✅ Keyboard shortcuts (Option+Shift+A/R/S)
- ✅ Playback controls (pause/resume/fast-forward/rewind/stop) for read-aloud

## 📁 Project Structure

```
<project-root>/
├── manifest.json              # Extension configuration (permissions: tts, tabs, scripting, activeTab, storage)
├── popup/
│   ├── popup.html            # Main UI (voice controls, settings, accessibility tools)
│   ├── popup.css             # Modern, accessible styling
│   └── popup.js              # UI logic, message handling, playback controls
├── scripts/
│   ├── background.js         # Service worker (EXECUTE_COMMAND, AI_PARSE, read_page TTS, keyboard commands)
│   └── content.js            # Speech recognition, page interaction, simplify reading
├── utils/
│   └── commands.js           # Command schema, AI prompt, fallback parsing
├── icons/                    # Extension icons (user must create)
│   └── icon16.png, icon48.png, icon128.png
├── ai-proxy/                 # Local Node server (Gemini)
│   ├── server.js            # POST /parse
│   ├── package.json
│   └── .env                 # GEMINI_API_KEY (create this)
├── README.md                 # Comprehensive documentation
├── SETUP.md                  # Quick setup guide
├── TROUBLESHOOTING.md        # Troubleshooting guide
└── .gitignore                # Git ignore rules
```

## 🔧 Technical Implementation

### Technologies Used:
- **Chrome Extension Manifest V3** (latest standard)
- **Web Speech API** (STT - runs in content script, no external API needed)
- **Chrome TTS API** (`chrome.tts` - for read page aloud in background)
- **Web Speech Synthesis API** (TTS - for voice feedback in popup)
- **Google Gemini** (command understanding via local ai-proxy)
- **Vanilla JavaScript** (no frameworks, lightweight)
- **Chrome Storage API** (local settings storage)

### Architecture Flow:
```
User Voice → Content Script (Web Speech API STT)
         → Popup (transcript handling)
         → Background Script (NLU via Gemini ai-proxy or fallback)
         → Content Script (Action Execution) or Background (TTS for read_page)
         → Chrome TTS API (read page aloud) or Web Speech Synthesis (voice feedback)
```

### Key Design Decisions:
1. **No external STT/TTS APIs**: Uses browser-native APIs for cost efficiency
2. **Content script STT**: Speech recognition runs in page context for better reliability
3. **Background TTS for read_page**: Uses `chrome.tts` API for reliable read-aloud without user gesture restrictions
4. **Fallback pattern matching**: Works even if Gemini proxy unavailable
5. **Modular architecture**: Easy for team members to work on separate modules
6. **Accessibility first**: UI designed with accessibility in mind, includes Simplified Reading and Target Size controls
7. **Privacy focused**: API key stored only in ai-proxy/.env, extension never sees the key

## 🚀 Setup Requirements

### Prerequisites:
1. Chrome Browser (v88+)
2. Node.js (for ai-proxy, e.g. 18+)
3. Google Gemini API Key – [Create one](https://aistudio.google.com/apikey) (used only by the proxy)

### Quick Start:
1. Create icon files (see SETUP.md)
2. Set up ai-proxy: Create `ai-proxy/.env` with `GEMINI_API_KEY=your_key_here`, then `npm install && npm start`
3. Load extension in Chrome (`chrome://extensions/`)
4. Grant microphone permission when prompted
5. Start using!

## 🎮 Usage Examples

### Voice Commands:
- "scroll down" → Scrolls page down
- "click submit" → Finds and clicks Submit button
- "go back" → Browser back navigation
- "read this page" → Extracts and reads page content aloud
- "stop" → Stops reading immediately
- "search for cats" → Performs search on page
- "open google" → Opens Google in new tab

### Keyboard Shortcuts:
- **Option+Shift+A** (Mac) / **Alt+Shift+A** (Win/Linux) → Activate assistant
- **Option+Shift+R** / **Alt+Shift+R** → Read page aloud
- **Option+Shift+S** / **Alt+Shift+S** → Stop reading

### Accessibility Tools:
- **Simplified Reading**: Click button to simplify page layout (removes ads/nav, optimizes typography)
- **Target Size**: Increase/decrease click target sizes for easier interaction

## 🏆 Hackathon Alignment

### Problem Statement Match:
✅ **Addresses visual impairments**: Voice control, read page aloud, Simplified Reading
✅ **Addresses motor impairments**: No mouse/keyboard needed, Target Size controls
✅ **Addresses cognitive impairments**: Natural language, simple commands, Simplified Reading
✅ **Multimodal interaction**: Voice + audio feedback + visual UI
✅ **Adaptive**: AI understands context and vague commands
✅ **Demonstrable**: Can be tested live on any website

### Accessibility Features:
- Voice-only navigation
- Audio feedback for all actions
- Read page aloud with playback controls (pause/resume/fast-forward/rewind/stop)
- Simplified Reading mode (cleaner layout, optimized typography)
- Target Size controls (increase/decrease click targets)
- Keyboard shortcuts for quick access
- Simple, clear UI
- Error messages in plain language

## 📊 Team Module Ownership

As per original plan:
- **Member 1**: STT & Audio → `popup.js` (STT implementation)
- **Member 2**: NLU & GPT → `utils/commands.js`, `scripts/background.js`
- **Member 3**: Action Execution → `scripts/content.js`
- **Member 4**: TTS + Integration + Image → `popup.js` (TTS), integration, image analysis

## 🔮 Future Enhancements (Stretch Goals)

- [ ] Wake word detection ("Hey Assist")
- [ ] Multi-language support
- [ ] Custom command training
- [ ] Enhanced image Q&A (if re-implemented)
- [ ] Voice command personalization
- [ ] More web app integrations
- [ ] Offline mode
- [ ] Visual Alerts (for deaf users)
- [ ] Auto-Captions (for deaf users)
- [ ] High Contrast mode

## 📝 Notes

### Known Limitations:
1. Requires Chrome browser (Web Speech API limitation)
2. Needs Google Gemini API key (via ai-proxy)
3. Icon files must be created manually
4. Some websites may block content scripts
5. Voice recognition requires microphone permission
6. Read-aloud works best on normal web pages (not chrome:// pages)

### Testing Recommendations:
- Test on various websites (Wikipedia, Gmail, YouTube)
- Try different voice commands
- Test Simplified Reading on various page types
- Test Target Size controls
- Test read-aloud with playback controls (pause/resume/fast-forward/rewind/stop)
- Verify error handling (proxy unavailable, no internet, etc.)
- Check accessibility with screen readers
- Test keyboard shortcuts (Option+Shift+A/R/S)

## ✨ Highlights

1. **Complete MVP**: All core features implemented and working
2. **Production-ready**: Error handling, fallbacks, user feedback
3. **Well-documented**: Comprehensive README and setup guides
4. **Accessible design**: UI and functionality designed for accessibility
5. **Modular code**: Easy to extend and maintain
6. **Privacy-conscious**: Minimal data collection, local storage

---

**Ready for hackathon demo! 🎉**

