importScripts('../utils/commands.js');

const PROXY_BASE = 'http://localhost:3000';
async function getParsedCommand(text) {
    try {
        const resp = await fetch(`${PROXY_BASE}/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, systemPrompt: self.SYSTEM_PROMPT })
        });
        if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
        const data = await resp.json();
        const command = data?.command ?? self.fallbackParse(text);
        if (!command || command.action === 'UNKNOWN') {
            return self.fallbackParse(text);
        }
        return command;
    } catch (e) {
        return self.fallbackParse(text);
    }
}

async function analyzeImageWithAI(imageData) {
    const resp = await fetch(`${PROXY_BASE}/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
    });
    if (!resp.ok) throw new Error(`Proxy vision error: ${resp.status}`);
    const data = await resp.json();
    return data?.analysis ?? 'No analysis available';
}

async function executeMappedCommand(mapped) {
    console.log('[BACKGROUND DEBUG] Executing mapped command:', mapped);
    if (!mapped?.action) {
        return { message: mapped?.message ?? 'No action.', action: null };
    }

    if (mapped.action === 'open_website' && mapped.params?.url) {
        try {
            await chrome.tabs.create({ url: mapped.params.url });
            return { message: mapped.message ?? `Opening ${mapped.params.url}`, action: mapped.action };
        } catch (e) {
            return { message: `Error: ${e.message}`, action: null };
        }
    }

    if (mapped.action === 'describe_page') {
        try {
            const result = await captureAndDescribePage();
            if (result.success) {
                return { message: mapped.message ?? 'Page description generated', action: mapped.action, description: result.description };
            }
            return { message: result.error ?? 'Could not describe the page', action: null };
        } catch (e) {
            return { message: e.message ?? 'Could not describe the page', action: null };
        }
    }

    if (mapped.action === 'stop_reading') {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return { message: mapped.message ?? 'No active tab.', action: mapped.action };
            await chrome.tabs.sendMessage(tab.id, { type: 'stopReading' });
            return { message: mapped.message ?? 'Stopped reading', action: mapped.action };
        } catch (e) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 100));
                    await chrome.tabs.sendMessage(tab.id, { type: 'stopReading' });
                }
                return { message: mapped.message ?? 'Stopped reading', action: mapped.action };
            } catch (_) {
                return { message: mapped.message ?? 'Could not stop reading', action: mapped.action };
            }
        }
    }
    // Handle fast forward action
    if (mapped.action === 'fast_forward') {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return { message: mapped.message ?? 'No active tab.', action: mapped.action };
            await chrome.tabs.sendMessage(tab.id, { type: 'fastForward' });
            return { message: mapped.message ?? 'Fast forwarded', action: mapped.action };
        } catch (e) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 100));
                    await chrome.tabs.sendMessage(tab.id, { type: 'fastForward' });
                }
                return { message: mapped.message ?? 'Fast forwarded', action: mapped.action };
            } catch (_) {
                return { message: mapped.message ?? 'Could not fast forward', action: mapped.action };
            }
        }
    }

    // Handle rewind action
    if (mapped.action === 'rewind') {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return { message: mapped.message ?? 'No active tab.', action: mapped.action };
            await chrome.tabs.sendMessage(tab.id, { type: 'rewind' });
            return { message: mapped.message ?? 'Rewound', action: mapped.action };
        } catch (e) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 100));
                    await chrome.tabs.sendMessage(tab.id, { type: 'rewind' });
                }
                return { message: mapped.message ?? 'Rewound', action: mapped.action };
            } catch (_) {
                return { message: mapped.message ?? 'Could not rewind', action: mapped.action };
            }
        }
    }


    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { message: mapped.message ?? 'No active tab.', action: mapped.action };

    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.includes("chromewebstore.google.com"))) {
        return { message: "Can't read aloud on this page due to Chrome restrictions.", action: null };
    }

    try {
        console.log('[BACKGROUND DEBUG] Sending executeAction to tab:', tab.id, 'Action:', mapped.action, 'Params:', mapped.params);
        const executionResult = await chrome.tabs.sendMessage(tab.id, {
            type: 'executeAction',
            action: mapped.action,
            params: mapped.params ?? {}
        });
        console.log('[BACKGROUND DEBUG] Execution result:', executionResult);
        return {
            message: mapped.message ?? executionResult?.message ?? 'Done.',
            action: mapped.action,
            content: executionResult?.content,
            description: executionResult?.description,
            tabId: tab.id
        };
    } catch (error) {
        console.log('[BACKGROUND DEBUG] Error executing action, trying to inject script:', error.message);
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/content.js'] });
            await new Promise(r => setTimeout(r, 100));
            const executionResult = await chrome.tabs.sendMessage(tab.id, {
                type: 'executeAction',
                action: mapped.action,
                params: mapped.params ?? {}
            });
            return {
                message: mapped.message ?? executionResult?.message ?? 'Done.',
                action: mapped.action,
                content: executionResult?.content,
                description: executionResult?.description,
                tabId: tab.id
            };
        } catch (_) {
            return { message: mapped.message ?? 'Could not execute on this page.', action: mapped.action };
        }
    }
}

async function handleCommandProcessing(command) {
    try {
        const parsed = await getParsedCommand(command);
        const mapped = self.mapParsedToInternal(parsed);
        return executeMappedCommand(mapped);
    } catch (e) {
        return { message: e.message ?? 'Error', action: null };
    }
}

async function handleImageAnalysis(imageData) {
    try {
        const analysis = await analyzeImageWithAI(imageData);
        return { analysis };
    } catch (e) {
        return { error: e.message };
    }
}

async function handleActionExecution(action, params) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: 'No active tab found' };
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'executeAction', action, params: params ?? {} });
        return result ?? { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

async function captureAndDescribePage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: 'No active tab found' };
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
        const analysis = await analyzeImageWithAI(dataUrl);
        return { success: true, description: analysis, message: 'Page description generated' };
    } catch (e) {
        return { error: e.message };
    }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    const asyncResponse = (p) => {
        p.then(sendResponse).catch(e => sendResponse({ error: e.message }));
    };

    if (request.type === 'processCommand') {
        asyncResponse(handleCommandProcessing(request.command));
        return true;
    }
    if (request.type === 'AI_PARSE_COMMAND') {
        getParsedCommand(request.text).then(parsed => sendResponse({ command: parsed })).catch(() => sendResponse({ command: self.fallbackParse(request.text) }));
        return true;
    }
    if (request.type === 'EXECUTE_COMMAND') {
        const mapped = self.mapParsedToInternal(request.command ?? { action: 'UNKNOWN' });
        asyncResponse(executeMappedCommand(mapped));
        return true;
    }
    if (request.type === 'analyzeImage') {
        asyncResponse(handleImageAnalysis(request.imageData));
        return true;
    }
    if (request.type === 'executeAction') {
        asyncResponse(handleActionExecution(request.action, request.params));
        return true;
    }
    if (request.type === 'SPEAK_IN_TAB') {
        asyncResponse((async () => {
            const tabId = request.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!tabId || !request.text) return { success: true };
            try {
                await chrome.tabs.sendMessage(tabId, { type: 'speak', text: request.text });
            } catch (e) {
                try {
                    await chrome.scripting.executeScript({ target: { tabId }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 200));
                    await chrome.tabs.sendMessage(tabId, { type: 'speak', text: request.text });
                } catch (_) { }
            }
            return { success: true };
        })());
        return true;
    }
    if (request.type === 'STOP_READING') {
        asyncResponse((async () => {
            const tabId = request.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!tabId) return { success: true };
            try {
                await chrome.tabs.sendMessage(tabId, { type: 'stopReading' });
            } catch (e) {
                try {
                    await chrome.scripting.executeScript({ target: { tabId }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 100));
                    await chrome.tabs.sendMessage(tabId, { type: 'stopReading' });
                } catch (_) { }
            }
            return { success: true };
        })());
        return true;
    }
    // New handlers for fast forward and rewind
    if (request.type === 'FAST_FORWARD') {
        asyncResponse((async () => {
            const tabId = request.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!tabId) return { success: true };
            try {
                await chrome.tabs.sendMessage(tabId, { type: 'fastForward' });
            } catch (e) {
                try {
                    await chrome.scripting.executeScript({ target: { tabId }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 100));
                    await chrome.tabs.sendMessage(tabId, { type: 'fastForward' });
                } catch (_) { }
            }
            return { success: true };
        })());
        return true;
    }

    if (request.type === 'REWIND') {
        asyncResponse((async () => {
            const tabId = request.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!tabId) return { success: true };
            try {
                await chrome.tabs.sendMessage(tabId, { type: 'rewind' });
            } catch (e) {
                try {
                    await chrome.scripting.executeScript({ target: { tabId }, files: ['scripts/content.js'] });
                    await new Promise(r => setTimeout(r, 100));
                    await chrome.tabs.sendMessage(tabId, { type: 'rewind' });
                } catch (_) { }
            }
            return { success: true };
        })());
        return true;
    }
    if (request.type === 'captureAndDescribePage') {
        asyncResponse(captureAndDescribePage());
        return true;
    }
    if (['speechRecognitionResult', 'speechRecognitionError', 'speechRecognitionStatus'].includes(request.type)) {
        chrome.runtime.sendMessage(request).catch(() => { });
        return false;
    }
});

chrome.runtime.onInstalled.addListener(() => { });
