importScripts('../utils/commands.js');

let ttsChunks = [];
let ttsIndex = 0;
let ttsIsReading = false;

function chunkText(text, size = 800) {
  return (text || '').trim().match(new RegExp(`.{1,${size}}(\\s|$)`, 'g')) || [];
}

function speakChunkAt(i) {
  if (!ttsIsReading || i < 0 || i >= ttsChunks.length) {
    ttsIsReading = false;
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
      if (e.type === 'end') {
        if (ttsIsReading) speakChunkAt(ttsIndex + 1);
      }
      if (e.type === 'error') {
        console.error('[BACKGROUND TTS] error:', e.errorMessage);
        if (ttsIsReading) speakChunkAt(ttsIndex + 1);
      }
    }
  });
}

function startTtsReading(text) {
  ttsChunks = chunkText(text, 800);
  ttsIndex = 0;
  ttsIsReading = ttsChunks.length > 0;
  if (ttsIsReading) speakChunkAt(0);
}

function stopTtsReading() {
  ttsIsReading = false;
  ttsChunks = [];
  ttsIndex = 0;
  chrome.tts.stop();
}

function ffTts() {
  if (!ttsIsReading) return;
  speakChunkAt(Math.min(ttsIndex + 1, ttsChunks.length - 1));
}

function rwTts() {
  if (!ttsIsReading) return;
  speakChunkAt(Math.max(ttsIndex - 1, 0));
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
      return { message: 'Reading page aloud.', action: 'read_page', content: text };
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
