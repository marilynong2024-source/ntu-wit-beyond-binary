importScripts('../utils/commands.js');

let ttsChunks = [];
let ttsIndex = 0;
let ttsIsReading = false;
let ttsIsPaused = false;

function chunkText(text, size = 800) {
  return (text || '').trim().match(new RegExp(`.{1,${size}}(\\s|$)`, 'g')) || [];
}

function speakChunkAt(i) {
  // Check state at the very start - if stopped, don't continue
  if (!ttsIsReading || i < 0 || i >= ttsChunks.length) {
    // Reading finished naturally (reached end)
    const wasReading = ttsIsReading;
    ttsIsReading = false;
    ttsIsPaused = false;
    if (wasReading) {
      // Notify that reading ended naturally
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'readPageEnded' }).catch(() => {});
        }
      }).catch(() => {});
    }
    return;
  }

  ttsIndex = i;
  chrome.tts.stop();

  chrome.tts.speak(ttsChunks[ttsIndex], {
    lang: 'en-US',
    rate: 1,
    pitch: 1,
    volume: 1,
    onEvent: (e) => {
      // Double-check state before continuing - prevents continuation after stop
      if (!ttsIsReading) {
        console.log('[BACKGROUND TTS] Ignoring event - reading stopped');
        return;
      }
      
      if (e.type === 'end') {
        // Only continue if still reading and not paused
        if (ttsIsReading && !ttsIsPaused) {
          speakChunkAt(ttsIndex + 1);
        }
      }
      if (e.type === 'error') {
        console.error('[BACKGROUND TTS] error:', e.errorMessage);
        // Only continue on error if still reading and not paused
        if (ttsIsReading && !ttsIsPaused) {
          speakChunkAt(ttsIndex + 1);
        }
      }
    }
  });
}

function startTtsReading(text) {
  ttsChunks = chunkText(text, 800);
  ttsIndex = 0;
  ttsIsReading = ttsChunks.length > 0;
  ttsIsPaused = false;
  if (ttsIsReading) speakChunkAt(0);
}

function stopTtsReading() {
  const wasReading = ttsIsReading;
  // Set flag FIRST to prevent any queued events from continuing
  ttsIsReading = false;
  ttsIsPaused = false;
  // Stop TTS immediately
  chrome.tts.stop();
  // Clear state
  ttsChunks = [];
  ttsIndex = 0;
  console.log('[BACKGROUND TTS] Stopped reading');
  // Notify that reading ended
  if (wasReading) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'readPageEnded' }).catch(() => {});
      }
    }).catch(() => {});
  }
}

function pauseTtsReading() {
  if (!ttsIsReading || ttsIsPaused) return;
  ttsIsPaused = true;
  chrome.tts.stop();
  console.log('[BACKGROUND TTS] Paused reading at chunk', ttsIndex);
}

function resumeTtsReading() {
  if (!ttsIsReading || !ttsIsPaused) return;
  ttsIsPaused = false;
  console.log('[BACKGROUND TTS] Resumed reading from chunk', ttsIndex);
  speakChunkAt(ttsIndex);
}

function ffTts() {
  if (!ttsIsReading) return;
  // Skip ahead 3 chunks (as UI indicates)
  const newIndex = Math.min(ttsIndex + 3, ttsChunks.length - 1);
  console.log('[BACKGROUND TTS] Fast forward from chunk', ttsIndex, 'to', newIndex);
  // Resume if paused (fast forward implies resuming)
  if (ttsIsPaused) {
    ttsIsPaused = false;
  }
  speakChunkAt(newIndex);
}

function rwTts() {
  if (!ttsIsReading) return;
  // Skip back 3 chunks (as UI indicates)
  const newIndex = Math.max(ttsIndex - 3, 0);
  console.log('[BACKGROUND TTS] Rewind from chunk', ttsIndex, 'to', newIndex);
  // Resume if paused (rewind implies resuming)
  if (ttsIsPaused) {
    ttsIsPaused = false;
  }
  speakChunkAt(newIndex);
}

async function executeMappedCommand(mapped) {
  console.log('[BACKGROUND DEBUG] executeMappedCommand:', mapped?.action, mapped);
  if (!mapped || !mapped.action) {
    return { message: 'Unknown command.', action: null };
  }

  if (mapped.action === 'read_page') {
    console.log('[BACKGROUND DEBUG] read_page: querying active tab');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.error('[BACKGROUND DEBUG] read_page: no active tab');
      return { message: 'No active tab.', action: null };
    }
    console.log('[BACKGROUND DEBUG] read_page: sending executeAction to tab', tab.id);

    try {
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: 'executeAction',
        action: 'read_page',
        params: {}
      });
      console.log('[BACKGROUND DEBUG] read_page: content script response', res ? { message: res.message, contentLength: res.content?.length } : res);

      const text = (res?.content || '').trim();
      if (!text) {
        console.warn('[BACKGROUND DEBUG] read_page: no text in response');
        return { message: 'No readable text found.', action: null };
      }
      console.log('[BACKGROUND DEBUG] read_page: starting TTS, text length:', text.length);
      startTtsReading(text);
      // Notify that reading started
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'readPageStarted' }).catch(() => {});
      } catch (_) {}
      return { message: 'Reading page aloud.', action: 'read_page', content: text, tabId: tab.id };
    } catch (e) {
      console.error('[BACKGROUND DEBUG] read_page error:', e);
      return { message: 'Could not read page: ' + (e.message || 'injection failed'), action: null };
    }
  }

  if (mapped.action === 'stop_reading') {
    stopTtsReading();
    return { message: 'Stopped reading.', action: 'stop_reading' };
  }

  if (mapped.action === 'fast_forward') {
    ffTts();
    return { message: 'Fast forwarded.', action: 'fast_forward' };
  }

  if (mapped.action === 'rewind') {
    rwTts();
    return { message: 'Rewound.', action: 'rewind' };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { message: 'No active tab.', action: null };
  try {
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: 'executeAction',
      action: mapped.action,
      params: mapped.params || {}
    });
    return {
      message: res?.message || 'Done',
      description: res?.description,
      content: res?.content,
      action: mapped.action
    };
  } catch (e) {
    console.error('[BACKGROUND] executeAction error:', e);
    return { message: 'Error: ' + (e.message || 'failed'), action: mapped.action };
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[BACKGROUND DEBUG] Message received:', request.type, request.type === 'EXECUTE_COMMAND' ? request.command : (request.type === 'AI_PARSE_COMMAND' ? request.text : ''));
  
  // Handle TTS control messages directly
  if (request.type === 'STOP_READING') {
    stopTtsReading();
    sendResponse({ success: true, message: 'Stopped reading' });
    return false;
  }
  
  if (request.type === 'PAUSE_READING') {
    pauseTtsReading();
    sendResponse({ success: true, message: 'Paused reading' });
    return false;
  }
  
  if (request.type === 'RESUME_READING') {
    resumeTtsReading();
    sendResponse({ success: true, message: 'Resumed reading' });
    return false;
  }
  
  if (request.type === 'FAST_FORWARD') {
    ffTts();
    sendResponse({ success: true, message: 'Fast forwarded' });
    return false;
  }
  
  if (request.type === 'REWIND') {
    rwTts();
    sendResponse({ success: true, message: 'Rewound' });
    return false;
  }
  
  if (request.type === 'EXECUTE_COMMAND') {
    const mapped = self.mapParsedToInternal(request.command ?? { action: 'UNKNOWN' });
    console.log('[BACKGROUND DEBUG] Mapped command:', mapped);
    executeMappedCommand(mapped).then((result) => {
      console.log('[BACKGROUND DEBUG] executeMappedCommand result:', result?.message, 'action:', result?.action);
      sendResponse(result);
    }).catch(e => {
      console.error('[BACKGROUND DEBUG] executeMappedCommand error:', e);
      sendResponse({ error: e.message });
    });
    return true;
  }
  if (request.type === 'AI_PARSE_COMMAND') {
    const fallback = self.fallbackParse(request.text);
    console.log('[BACKGROUND DEBUG] AI_PARSE fallback:', fallback);
    sendResponse({ command: fallback });
    return false;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  console.log('[BACKGROUND DEBUG] Command received:', command);
  if (command === 'read_page') {
    const mapped = { action: 'read_page', params: {}, message: 'Reading page aloud.' };
    await executeMappedCommand(mapped);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'readPageStarted' }).catch(() => {});
    } catch (_) {}
  }
  if (command === 'stop_reading') {
    stopTtsReading();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'STOP_SPEECH' }).catch(() => {});
    } catch (_) {}
  }
  if (command === 'activate_assistant') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_ASSISTANT' }).catch(() => {});
    } catch (_) {}
  }
});
