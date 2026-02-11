// utils/commands.js
// Loaded by background.js via importScripts() - attach to global scope

// --------------------
// Command JSON schema
// --------------------
const COMMAND_SCHEMA = {
    type: "object",
    properties: {
        action: {
            type: "string",
            enum: [
                "OPEN_URL", "SCROLL", "CLICK", "SEARCH", "READ_PAGE",
                "BACK", "FORWARD", "REFRESH", "CLICK_BUTTON",
                "SCROLL_TOP", "SCROLL_BOTTOM", "DESCRIBE_PAGE",
                "STOP_READING", "ENLARGE_TARGETS", "INCREASE_TARGET_SIZE",
                "DECREASE_TARGET_SIZE", "UNKNOWN"
            ]
        },
        url: { type: "string" },
        query: { type: "string" },
        direction: {
            type: "string",
            enum: ["up", "down"]
        },
        targetText: { type: "string" },
        buttonName: { type: "string" }
    },
    required: ["action"]
};

// --------------------
// System prompt
// --------------------
const SYSTEM_PROMPT = `You are an assistant that converts a spoken browser command into a JSON object.
  
  Only return valid JSON.
  Do not add explanations.
  
  Follow this schema exactly:
  
  {
    "action": "OPEN_URL | SCROLL | CLICK | SEARCH | READ_PAGE | BACK | FORWARD | REFRESH | CLICK_BUTTON | SCROLL_TOP | SCROLL_BOTTOM | DESCRIBE_PAGE | STOP_READING | ENLARGE_TARGETS | INCREASE_TARGET_SIZE | DECREASE_TARGET_SIZE | UNKNOWN",
    "url": string (only for OPEN_URL),
    "query": string (only for SEARCH),
    "direction": "up | down" (only for SCROLL),
    "targetText": string (only for CLICK or CLICK_BUTTON),
    "buttonName": string (only for CLICK_BUTTON)
  }
  
  Rules:
  - If the user asks to open a website, use OPEN_URL and provide a full https URL.
  - If the user asks to scroll down, use SCROLL with direction "down".
  - If the user asks to scroll up, use SCROLL with direction "up".
  - If the user asks to go to top of page, use SCROLL_TOP.
  - If the user asks to go to bottom of page, use SCROLL_BOTTOM.
  - If the user asks to click something visible, use CLICK and put the FULL visible label/text in targetText (e.g., "click on diseases and parasites" → targetText: "diseases and parasites", NOT just "on").
  - If the user asks to click a button by name, use CLICK_BUTTON and put the COMPLETE button name in buttonName (e.g., "click diseases and parasites button" → buttonName: "diseases and parasites").
  - IMPORTANT: When extracting element names from phrases like "click on X" or "click the X button", extract the ENTIRE phrase X, not just the last word. Ignore common words like "on", "the", "button" when they appear before/after the actual element name.
  - If the user asks to go back, use BACK.
  - If the user asks to go forward, use FORWARD.
  - If the user asks to refresh, use REFRESH.
  - If the user asks to search, use SEARCH and put the search text in query.
  - If the user asks to read the page, use READ_PAGE.
  - If the user asks to describe the page or what the page looks like, use DESCRIBE_PAGE.
  - If the user asks to stop reading, stop speaking, or pause reading, use STOP_READING.
  - If the user asks for larger click targets, bigger buttons, bigger text, zoom in, or increase target size, use INCREASE_TARGET_SIZE.
  - If the user asks for smaller click targets, smaller buttons, zoom out, or decrease target size, use DECREASE_TARGET_SIZE.
  - If you are not sure, return { "action": "UNKNOWN" }.`;

// --------------------
// Build AI request
// --------------------
function buildAIRequest(text) {
    return {
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text }
        ],
        schema: COMMAND_SCHEMA
    };
}

// --------------------
// Safe JSON parsing
// --------------------
function parseAIResponse(rawText) {
    try {
        const parsed = JSON.parse(rawText);
        return parsed && typeof parsed.action !== 'undefined' ? parsed : { action: "UNKNOWN" };
    } catch (e) {
        const jsonMatch = (rawText || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (_) { }
        }
        return { action: "UNKNOWN" };
    }
}

// --------------------
// Map COMMAND_SCHEMA output to internal action format
// --------------------
function mapParsedToInternal(parsed) {
    if (!parsed || !parsed.action) {
        return { action: null, params: {}, message: 'No action recognized.' };
    }
    const action = parsed.action;
    const messages = {
        OPEN_URL: (u) => `Opening ${u || 'website'}`,
        SCROLL: (d) => d === 'down' ? 'Scrolling down' : 'Scrolling up',
        SCROLL_TOP: () => 'Scrolling to top',
        SCROLL_BOTTOM: () => 'Scrolling to bottom',
        CLICK: (t) => t ? `Clicking ${t}` : 'Clicking',
        CLICK_BUTTON: (b) => b ? `Clicking ${b}` : 'Clicking button',
        SEARCH: (q) => q ? `Searching for ${q}` : 'Searching',
        READ_PAGE: () => 'Reading page content',
        STOP_READING: () => 'Stopping reading',
        ENLARGE_TARGETS: () => 'Increasing target size',
        INCREASE_TARGET_SIZE: () => 'Increasing target size',
        DECREASE_TARGET_SIZE: () => 'Decreasing target size',
        BACK: () => 'Going back',
        FORWARD: () => 'Going forward',
        REFRESH: () => 'Refreshing page',
        DESCRIBE_PAGE: () => 'Describing the page visually',
        UNKNOWN: () => 'Command not recognized.'
    };
    const getMessage = (key) => (typeof messages[key] === 'function' ? messages[key](parsed.url || parsed.query || parsed.direction || parsed.targetText || parsed.buttonName) : 'Done.');

    switch (action) {
        case 'OPEN_URL':
            return {
                action: 'open_website',
                params: { url: parsed.url || '' },
                message: getMessage('OPEN_URL')
            };
        case 'SCROLL':
            if (parsed.direction === 'down') {
                return { action: 'scroll_down', params: {}, message: getMessage('SCROLL') };
            }
            if (parsed.direction === 'up') {
                return { action: 'scroll_up', params: {}, message: getMessage('SCROLL') };
            }
            return { action: 'scroll_down', params: {}, message: 'Scrolling down' };
        case 'SCROLL_TOP':
            return { action: 'scroll_to_top', params: {}, message: getMessage('SCROLL_TOP') };
        case 'SCROLL_BOTTOM':
            return { action: 'scroll_to_bottom', params: {}, message: getMessage('SCROLL_BOTTOM') };
        case 'CLICK':
        case 'CLICK_BUTTON': {
            const name = parsed.buttonName || parsed.targetText || '';
            return {
                action: 'click_element',
                params: { elementName: name },
                message: getMessage(parsed.buttonName ? 'CLICK_BUTTON' : 'CLICK')
            };
        }
        case 'SEARCH':
            return {
                action: 'search',
                params: { query: parsed.query || '' },
                message: getMessage('SEARCH')
            };
        case 'READ_PAGE':
            return { action: 'read_page', params: {}, message: getMessage('READ_PAGE') };
        case 'STOP_READING':
            return { action: 'stop_reading', params: {}, message: getMessage('STOP_READING') };
        case 'ENLARGE_TARGETS':
        case 'INCREASE_TARGET_SIZE':
            return { action: 'increase_target_size', params: {}, message: getMessage(parsed.action) };
        case 'DECREASE_TARGET_SIZE':
            return { action: 'decrease_target_size', params: {}, message: getMessage('DECREASE_TARGET_SIZE') };
        case 'BACK':
            return { action: 'go_back', params: {}, message: getMessage('BACK') };
        case 'FORWARD':
            return { action: 'go_forward', params: {}, message: getMessage('FORWARD') };
        case 'REFRESH':
            return { action: 'refresh', params: {}, message: getMessage('REFRESH') };
        case 'DESCRIBE_PAGE':
            return { action: 'describe_page', params: {}, message: getMessage('DESCRIBE_PAGE') };
        default:
            return { action: null, params: {}, message: getMessage('UNKNOWN') };
    }
}

// --------------------
// Fallback (no AI)
// --------------------
function fallbackParse(text) {
    const t = (text || '').toLowerCase().trim();

    if (t.includes("open youtube")) {
        return { action: "OPEN_URL", url: "https://www.youtube.com" };
    }
    if (t.includes("open gmail")) {
        return { action: "OPEN_URL", url: "https://mail.google.com" };
    }
    if (t.includes("open google")) {
        return { action: "OPEN_URL", url: "https://www.google.com" };
    }
    if (t.includes("scroll down")) {
        return { action: "SCROLL", direction: "down" };
    }
    if (t.includes("scroll up")) {
        return { action: "SCROLL", direction: "up" };
    }
    if (t.includes("go to top") || t.includes("scroll to top")) {
        return { action: "SCROLL_TOP" };
    }
    if (t.includes("go to bottom") || t.includes("scroll to bottom")) {
        return { action: "SCROLL_BOTTOM" };
    }
    if (t.includes("go back") || t.includes("back")) {
        return { action: "BACK" };
    }
    if (t.includes("go forward") || t.includes("forward")) {
        return { action: "FORWARD" };
    }
    if (t.includes("refresh") || t.includes("reload")) {
        return { action: "REFRESH" };
    }
    if (t.includes("click")) {
        const patterns = [
            /click\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+button)?(?:\s*$|\.|,)/i,
            /click\s+(?:on\s+)?(.+?)(?:\s*$|\.|,)/i
        ];
        for (const pattern of patterns) {
            const match = t.match(pattern);
            if (match && match[1]) {
                let name = match[1].trim();
                const nameLower = name.toLowerCase();
                if (nameLower === 'on' || nameLower === 'the' || name.length < 3) {
                    continue;
                }
                if (nameLower.startsWith('on ') || nameLower.startsWith('the ')) {
                    name = name.replace(/^(on|the)\s+/i, '').trim();
                }
                if (name && name.length >= 3) {
                    return { action: "CLICK_BUTTON", buttonName: name };
                }
            }
        }
    }
    if (t.includes("read page") || t.includes("read this page") || t.includes("read the page") ||
        t.includes("read aloud") || t.includes("read article") || t.includes("read the article") ||
        t.includes("speak page") || t.includes("speak this") || t.includes("read text")) {
        return { action: "READ_PAGE" };
    }
    if (t.includes("stop reading") || t.includes("stop speaking") || t.includes("pause reading") ||
        t.includes("stop read") || t.includes("stop the reading") || t.includes("cancel reading")) {
        return { action: "STOP_READING" };
    }
    if (t.includes("describe") && (t.includes("page") || t.includes("this"))) {
        return { action: "DESCRIBE_PAGE" };
    }
    if (t.includes("what does") && t.includes("look like")) {
        return { action: "DESCRIBE_PAGE" };
    }
    if (t.includes("search for") || t.includes("google")) {
        const searchMatch = t.match(/(?:search for|google)\s+(.+)/i);
        if (searchMatch && searchMatch[1]) {
            return { action: "SEARCH", query: searchMatch[1].trim() };
        }
    }
    const wantsLargerTargets =
        /increase\s+(the\s+)?(target|targets|button|buttons|click target)\s*size/.test(t) ||
        /(?:larger|bigger)\s+(?:click\s+)?(?:target|targets|button|buttons|text)/.test(t) ||
        /(?:target|targets|button|buttons|text)\s+(?:larger|bigger)/.test(t) ||
        /zoom\s+in/.test(t);
    if (wantsLargerTargets) {
        return { action: "INCREASE_TARGET_SIZE" };
    }
    const wantsSmallerTargets =
        /(?:decrease|reduce)\s+(the\s+)?(target|targets|button|buttons|click target)\s*size/.test(t) ||
        /smaller\s+(?:click\s+)?(?:target|targets|button|buttons|text)/.test(t) ||
        /(?:target|targets|button|buttons|text)\s+smaller/.test(t) ||
        /zoom\s+out/.test(t);
    if (wantsSmallerTargets) {
        return { action: "DECREASE_TARGET_SIZE" };
    }
    if (t.includes("larger") && (t.includes("target") || t.includes("button"))) {
        return { action: "INCREASE_TARGET_SIZE" };
    }
    const openMatch = t.match(/open\s+(.+)/);
    if (openMatch && openMatch[1]) {
        let url = openMatch[1].trim();
        if (!url.startsWith('http')) {
            url = url.includes('.') ? `https://${url}` : `https://www.${url}.com`;
        }
        return { action: "OPEN_URL", url };
    }

    return { action: "UNKNOWN" };
}

// Expose for importScripts (no ES modules in service worker)
if (typeof self !== 'undefined') {
    self.COMMAND_SCHEMA = COMMAND_SCHEMA;
    self.SYSTEM_PROMPT = SYSTEM_PROMPT;
    self.buildAIRequest = buildAIRequest;
    self.parseAIResponse = parseAIResponse;
    self.mapParsedToInternal = mapParsedToInternal;
    self.fallbackParse = fallbackParse;
}

// Also expose for regular browser context (popup.js)
if (typeof window !== 'undefined') {
    window.COMMAND_SCHEMA = COMMAND_SCHEMA;
    window.SYSTEM_PROMPT = SYSTEM_PROMPT;
    window.buildAIRequest = buildAIRequest;
    window.parseAIResponse = parseAIResponse;
    window.mapParsedToInternal = mapParsedToInternal;
    window.fallbackParse = fallbackParse;
}
