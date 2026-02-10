# 🎤 Voice Commands Reference

## Complete List of Supported Commands

The AI Voice Assistant extension supports the following voice commands. You can use natural language - the AI will understand what you mean!

---

## 📜 **Scrolling Commands**

Control page scrolling with these commands:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"scroll down"** | Scrolls the page down | "scroll down" |
| **"scroll up"** | Scrolls the page up | "scroll up" |
| **"go to top"** | Scrolls to the top of the page | "go to top", "scroll to top" |
| **"go to bottom"** | Scrolls to the bottom of the page | "go to bottom", "scroll to bottom" |

**Natural Language Examples:**
- "Can you scroll down a bit?"
- "Scroll down the page"
- "Take me to the top"
- "Show me the bottom of the page"

---

## 🔄 **Navigation Commands**

Control browser navigation:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"go back"** | Navigate back in browser history | "go back", "back" |
| **"go forward"** | Navigate forward in browser history | "go forward", "forward" |
| **"refresh"** | Reload the current page | "refresh", "reload page" |

**Natural Language Examples:**
- "Take me back"
- "Go to the previous page"
- "Refresh this page"
- "Reload the website"

---

## 🖱️ **Click Commands**

Click buttons, links, or interactive elements by name:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"click [element name]"** | Finds and clicks an element by name | "click submit", "click login", "click sign in" |

**How It Works:**
- Searches for buttons, links, or clickable elements
- Matches by text content, aria-label, or title attribute
- Works with partial matches (e.g., "click sub" finds "Submit")

**Examples:**
- "click submit"
- "click the login button"
- "click sign in"
- "click next"
- "click read more"
- "click download"

**Natural Language Examples:**
- "Please click the submit button"
- "I want to click login"
- "Click on sign in"

---

## 📖 **Content Reading Commands**

Read page content aloud:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"read this page"** | Extracts and reads page content | "read this page", "read page", "read the content" |

**How It Works:**
- Extracts main content (skips navigation, ads, headers)
- Reads it aloud using text-to-speech
- Shows character count in response

**Natural Language Examples:**
- "What's on this page?"
- "Read the content to me"
- "Tell me what this page says"

---

## 🖼️ **Page Description Commands** ⭐ NEW!

Get a visual AI-powered description of the current web page:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"describe this page"** | Captures screenshot and provides visual description | "describe this page", "what does this page look like" |

**How It Works:**
- Captures a screenshot of the current page
- Sends it to GPT-4o Vision API for analysis
- Provides detailed visual description including:
  - Layout and structure
  - Colors and design elements
  - Text content (OCR)
  - Key visual elements
  - Accessibility insights

**Natural Language Examples:**
- "Describe this page"
- "What does this page look like?"
- "Tell me about the visual appearance of this page"
- "Describe the layout"

**Note**: Requires GPT-4o API access (same as image analysis feature)

---

## 🔍 **Search Commands**

Perform searches on the current page:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"search for [query]"** | Finds search box and performs search | "search for cats", "search artificial intelligence" |

**How It Works:**
- Finds the search input on the page
- Enters your query
- Submits the search

**Examples:**
- "search for dogs"
- "search artificial intelligence"
- "search python tutorial"
- "search for recipes"

**Natural Language Examples:**
- "I want to search for cats"
- "Can you search for python?"
- "Look up artificial intelligence"

---

## 🌐 **Website Navigation Commands**

Open new websites:

| Command | What It Does | Example |
|---------|--------------|---------|
| **"open [website]"** | Opens a website in a new tab | "open google", "open youtube.com" |

**How It Works:**
- Automatically adds `https://` if needed
- Adds `.com` if no domain extension provided
- Opens in a new tab

**Examples:**
- "open google" → Opens https://www.google.com
- "open youtube" → Opens https://www.youtube.com
- "open github.com" → Opens https://github.com
- "open wikipedia.org" → Opens https://www.wikipedia.org

**Natural Language Examples:**
- "I want to go to Google"
- "Open YouTube for me"
- "Take me to Wikipedia"

---

## 🖼️ **Image Analysis Commands**

Analyze images (via Image Explainer feature):

| Command | What It Does | Example |
|---------|--------------|---------|
| **Upload/Capture Image** | Analyze image with AI | Use the Image Explainer section in popup |

**Features:**
- Upload image files
- Capture screen/window
- Get detailed AI analysis including:
  - Visual description
  - Text extraction (OCR)
  - Object identification
  - Accessibility insights

---

## 💡 **Tips for Using Commands**

### 1. **Natural Language Works!**
You don't need exact keywords. The AI understands:
- ✅ "Can you scroll down?"
- ✅ "I want to go back"
- ✅ "Please click the submit button"
- ✅ "What's on this page?"

### 2. **Partial Matches Work**
For clicking elements:
- "click sub" will find "Submit"
- "click log" will find "Login"
- "click sign" will find "Sign In"

### 3. **Context Matters**
The AI understands context:
- "scroll down" vs "scroll up"
- "go back" vs "go forward"
- Natural variations of commands

### 4. **Error Handling**
If a command can't be executed:
- Clear error messages explain what went wrong
- Suggestions for alternative commands
- Fallback to pattern matching if AI is unavailable

---

## 🚫 **What It Can't Do**

The extension focuses on browser control. It **cannot**:
- ❌ Answer general knowledge questions (try "open wikipedia" instead)
- ❌ Check weather (try "open weather.com")
- ❌ Perform calculations (try "open calculator")
- ❌ Control your operating system
- ❌ Access files on your computer

**Workaround:** For things it can't do directly, try opening relevant websites:
- "open weather.com" for weather
- "open wikipedia" for information
- "open calculator" for calculations

---

## 📋 **Quick Reference Card**

### Most Common Commands:
1. **"scroll down"** - Scroll page down
2. **"scroll up"** - Scroll page up
3. **"go back"** - Browser back
4. **"click [button name]"** - Click element
5. **"read this page"** - Read content
6. **"search for [query]"** - Search page
7. **"open [website]"** - Open website
8. **"refresh"** - Reload page

### Navigation:
- go back, go forward, refresh

### Scrolling:
- scroll down, scroll up, go to top, go to bottom

### Interaction:
- click [element name]

### Content:
- read this page

### Search:
- search for [query]

### Websites:
- open [website name]

---

## 🎯 **Example Usage Scenarios**

### Scenario 1: Reading an Article
1. "scroll down" - Read more content
2. "scroll up" - Go back up
3. "read this page" - Hear the content

### Scenario 2: Filling a Form
1. "scroll down" - Find form fields
2. "click submit" - Submit the form

### Scenario 3: Browsing Multiple Sites
1. "open google" - Go to Google
2. "search for python tutorial" - Search
3. "click [result link]" - Open result
4. "go back" - Return to search

### Scenario 4: Navigation
1. "open youtube" - Go to YouTube
2. "scroll down" - Browse videos
3. "click [video title]" - Watch video
4. "go back" - Return to list

---

## 🔧 **Troubleshooting Commands**

### Command Not Working?

1. **Check you're on a regular website**
   - Doesn't work on `chrome://` pages
   - Works on regular websites

2. **Speak clearly**
   - Use clear pronunciation
   - Wait for "Listening..." status

3. **Check element exists**
   - For "click" commands, make sure the element is visible
   - Try scrolling to it first

4. **Check page has search**
   - For "search" commands, page needs a search box

5. **View command history**
   - Check "Recent Commands" section in popup
   - See what was recognized

---

**Happy Voice Controlling! 🎤**
