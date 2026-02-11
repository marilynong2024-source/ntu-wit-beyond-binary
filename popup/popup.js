let recognition = null;
let isListening = false;
let isReading = false;
let isPaused = false;
let synth = window.speechSynthesis;
let lastReadPageTabId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
    loadSettings();
    loadCommandHistory();
    setupEventListeners();
    checkMicrophonePermission();
    setupMessageListener();

    chrome.storage.local.get(['enableContinuousListening'], (result) => {
        if (result.enableContinuousListening) {
            setTimeout(() => {
                if (!isListening) {
                    tryContentScriptRecognition().catch(() => { });
                }
            }, 500);
        }
    });
});

function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'speechRecognitionResult') {
            handleSpeechResult(message.transcript);
        } else if (message.type === 'speechRecognitionError') {
            handleSpeechError(message.error);
        } else if (message.type === 'readPageStarted') {
            isReading = true;
            isPaused = false;
            document.getElementById('stopReadingBtn').style.display = 'block';
            const pauseResumeBtn = document.getElementById('pauseResumeBtn');
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = '⏸️ Pause';
                pauseResumeBtn.title = 'Pause reading';
            }
            // Show playback controls when reading starts
            document.getElementById('playbackControls').classList.add('active');
            document.getElementById('progressDisplay').classList.add('active');
        } else if (message.type === 'readPageEnded') {
            isReading = false;
            isPaused = false;
            document.getElementById('stopReadingBtn').style.display = 'none';
            const pauseResumeBtn = document.getElementById('pauseResumeBtn');
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = '⏸️ Pause';
                pauseResumeBtn.title = 'Pause reading';
            }
            // Hide playback controls when reading ends
            document.getElementById('playbackControls').classList.remove('active');
            document.getElementById('progressDisplay').classList.remove('active');
            document.getElementById('progressDisplay').textContent = '';
        } else if (message.type === 'speechProgress') {
            // Update progress display
            const progressDisplay = document.getElementById('progressDisplay');
            if (message.current && message.total) {
                progressDisplay.textContent = `Reading chunk ${message.current} of ${message.total}`;
            }
        } else if (message.type === 'readPageError') {
            isReading = false;
            document.getElementById('response').textContent =
                '⚠️ TTS Error: ' + (message.error || 'Could not read page aloud') +
                '\n\n💡 Try:\n' +
                '1. Check macOS System Settings → Accessibility → Spoken Content\n' +
                '2. Ensure "Speak selection" is ON\n' +
                '3. Set a System voice (e.g., Samantha)\n' +
                '4. Test: Select text and press Option+Esc';
            document.getElementById('responseBox').style.display = 'block';
        } else if (message.type === 'speechRecognitionStatus') {
            if (message.status === 'listening') {
                isListening = true;
                updateStatus('listening', 'Listening...');
                document.getElementById('listenBtnText').textContent = 'Listening...';
                document.getElementById('listenBtn').disabled = true;
            } else if (message.status === 'ended') {
                isListening = false;
                updateStatus('ready', 'Ready to listen');
                document.getElementById('listenBtnText').textContent = 'Start Listening';
                document.getElementById('listenBtn').disabled = false;
            }
        }
        return false;
    });
}

async function checkMicrophonePermission() {
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            if (result.state === 'denied') {
                updateStatus('ready', 'Microphone permission denied');
                document.getElementById('response').textContent =
                    '⚠️ Microphone permission is currently denied.\n\n' +
                    'Please enable it in Chrome Settings:\n' +
                    'Settings → Privacy → Site Settings → Microphone\n\n' +
                    'Then reload this extension.';
                document.getElementById('responseBox').style.display = 'block';
                const settingsBtn = document.getElementById('openSettingsBtn');
                if (settingsBtn) {
                    settingsBtn.style.display = 'block';
                }
            }
        } catch (e) {
        }
    }
}

function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            updateStatus('listening', 'Listening...');
            document.getElementById('listenBtnText').textContent = 'Listening...';
            document.getElementById('listenBtn').disabled = true;
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            await handleSpeechResult(transcript);
        };

        recognition.onerror = (event) => {
            isListening = false;
            document.getElementById('listenBtnText').textContent = 'Start Listening';
            document.getElementById('listenBtn').disabled = false;
            if (event.error === 'not-allowed') {
                updateStatus('ready', 'Ready to listen');
            }
            chrome.storage.local.get(['enableContinuousListening'], (result) => {
                if (result.enableContinuousListening && event.error !== 'not-allowed' && event.error !== 'aborted') {
                    setTimeout(() => {
                        if (!isListening && !isReading) {
                            tryContentScriptRecognition().catch(() => { });
                        }
                    }, 1000);
                }
            });
        };

        recognition.onend = () => {
            if (isListening) {
                isListening = false;
                updateStatus('ready', 'Ready to listen');
                document.getElementById('listenBtnText').textContent = 'Start Listening';
                document.getElementById('listenBtn').disabled = false;

                chrome.storage.local.get(['enableContinuousListening'], (result) => {
                    if (result.enableContinuousListening && !isReading) {
                        setTimeout(() => {
                            if (!isListening) {
                                tryContentScriptRecognition().catch(() => { });
                            }
                        }, 500);
                    }
                });
            }
        };
    }
}

function setupEventListeners() {
    document.getElementById('listenBtn').addEventListener('click', async () => {
        console.log('[POPUP DEBUG] Start Listening clicked, isListening:', isListening);
        if (!isListening) {
            // Immediate feedback so user sees something even if popup loses focus
            updateStatus('listening', 'Starting...');
            document.getElementById('listenBtnText').textContent = 'Starting...';
            document.getElementById('listenBtn').disabled = true;

            const contentSuccess = await tryContentScriptRecognition();
            console.log('[POPUP DEBUG] tryContentScriptRecognition result:', contentSuccess);
            if (!contentSuccess) {
                updateStatus('error', 'Could not start voice recognition');
                document.getElementById('listenBtnText').textContent = 'Start Listening';
                document.getElementById('listenBtn').disabled = false;
                document.getElementById('response').textContent =
                    '⚠️ Could not start voice recognition.\n\n' +
                    'Possible reasons:\n' +
                    '• You\'re on a chrome:// page (try a regular website)\n' +
                    '• Microphone permission denied (check Chrome Settings)\n' +
                    '• Content script not loaded (try refreshing the page)\n\n' +
                    '💡 Try:\n' +
                    '1. Navigate to a regular website (like google.com)\n' +
                    '2. Refresh the page\n' +
                    '3. Click "Start Listening" again';
                document.getElementById('responseBox').style.display = 'block';
            } else {
                // Content script accepted; show listening state (in case status message is delayed or lost)
                isListening = true;
                updateStatus('listening', 'Listening...');
                document.getElementById('listenBtnText').textContent = 'Listening...';
            }
        }
    });

    document.getElementById('uploadImageBtn').addEventListener('click', () => {
        document.getElementById('imageInput').click();
    });

    document.getElementById('imageInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            displayImagePreview(file);
        }
    });

    document.getElementById('captureScreenBtn').addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' },
                audio: false
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            video.addEventListener('loadedmetadata', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);

                canvas.toBlob((blob) => {
                    displayImagePreview(blob);
                    stream.getTracks().forEach(track => track.stop());
                }, 'image/png');
            });
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                alert('Screen capture permission denied. Please allow screen sharing.');
            } else {
                alert('Screen capture cancelled or failed: ' + error.message);
            }
        }
    });

    document.getElementById('analyzeImageBtn').addEventListener('click', async () => {
        const previewImg = document.getElementById('previewImg');
        if (previewImg.src) {
            await analyzeImage(previewImg.src);
        }
    });

    // Pause/Resume button handler
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    if (pauseResumeBtn) {
        pauseResumeBtn.addEventListener('click', () => {
            if (isReading) {
                if (isPaused) {
                    // Resume
                    chrome.runtime.sendMessage({ type: 'RESUME_READING' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[POPUP] Resume error:', chrome.runtime.lastError);
                        } else {
                            isPaused = false;
                            pauseResumeBtn.textContent = '⏸️ Pause';
                            pauseResumeBtn.title = 'Pause reading';
                        }
                    });
                } else {
                    // Pause
                    chrome.runtime.sendMessage({ type: 'PAUSE_READING' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[POPUP] Pause error:', chrome.runtime.lastError);
                        } else {
                            isPaused = true;
                            pauseResumeBtn.textContent = '▶️ Resume';
                            pauseResumeBtn.title = 'Resume reading';
                        }
                    });
                }
            }
        });
    }

    document.getElementById('stopReadingBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'STOP_READING' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[POPUP] Stop error:', chrome.runtime.lastError);
            }
            isReading = false;
            isPaused = false;
            document.getElementById('stopReadingBtn').style.display = 'none';
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = '⏸️ Pause';
                pauseResumeBtn.title = 'Pause reading';
            }
            document.getElementById('playbackControls').classList.remove('active');
            document.getElementById('progressDisplay').classList.remove('active');
        });
    });

    // Fast forward button handler
    const fastForwardBtn = document.getElementById('fastForwardBtn');
    if (fastForwardBtn) {
        fastForwardBtn.addEventListener('click', () => {
            if (isReading) {
                chrome.runtime.sendMessage({ type: 'FAST_FORWARD' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[POPUP] Fast forward error:', chrome.runtime.lastError);
                    }
                });
            }
        });
    }

    // Rewind button handler
    const rewindBtn = document.getElementById('rewindBtn');
    if (rewindBtn) {
        rewindBtn.addEventListener('click', () => {
            if (isReading) {
                chrome.runtime.sendMessage({ type: 'REWIND' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[POPUP] Rewind error:', chrome.runtime.lastError);
                    }
                });
            }
        });
    }

    document.getElementById('clearHistory').addEventListener('click', () => {
        chrome.storage.local.set({ commandHistory: [] }, () => {
            loadCommandHistory();
        });
    });

    const openSettingsBtn = document.getElementById('openSettingsBtn');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            const detailedInstructions =
                '📋 COPY THIS URL AND PASTE IN CHROME ADDRESS BAR:\n\n' +
                'chrome://settings/content/microphone\n\n' +
                'Then:\n' +
                '1. Find your extension (chrome-extension://...)\n' +
                '2. Set microphone to "Allow"\n' +
                '3. Go to chrome://extensions/\n' +
                '4. Click refresh icon on this extension\n' +
                '5. Try "Start Listening" again\n\n' +
                '💡 Tip: Your extension ID is shown in chrome://extensions/';

            document.getElementById('response').textContent = detailedInstructions;
            document.getElementById('responseBox').style.display = 'block';

            // Try to copy URL to clipboard
            const url = 'chrome://settings/content/microphone';
            navigator.clipboard.writeText(url).then(() => {
                const originalText = openSettingsBtn.textContent;
                openSettingsBtn.textContent = '✅ URL Copied! Paste in address bar';
                setTimeout(() => {
                    openSettingsBtn.textContent = originalText;
                }, 2000);
            }).catch(() => { });
        });
    }
}

function updateStatus(state, text) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    statusDot.className = 'status-dot ' + state;
    statusText.textContent = text;
}

function speak(msg) {
    if (isReading) return;
    if (!msg || !synth) return;
    if (synth.speaking) synth.cancel();
    const u = new SpeechSynthesisUtterance(String(msg).trim());
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    synth.speak(u);
}

function loadSettings() {
    chrome.storage.local.get(['enableTTS', 'enableContinuousListening'], (result) => {
        if (result.enableTTS !== undefined) {
            document.getElementById('enableTTS').checked = result.enableTTS;
        }
        if (result.enableContinuousListening !== undefined) {
            document.getElementById('enableContinuousListening').checked = result.enableContinuousListening;
        }
    });
}

function saveCommandToHistory(command, response) {
    chrome.storage.local.get(['commandHistory'], (result) => {
        const history = result.commandHistory || [];
        history.unshift({
            command,
            response,
            timestamp: new Date().toISOString()
        });

        // Keep only last 20 commands
        if (history.length > 20) {
            history.pop();
        }

        chrome.storage.local.set({ commandHistory: history }, () => {
            loadCommandHistory();
        });
    });
}

function loadCommandHistory() {
    chrome.storage.local.get(['commandHistory'], (result) => {
        const history = result.commandHistory || [];
        const historyList = document.getElementById('commandHistory');

        if (history.length === 0) {
            historyList.innerHTML = '<p style="color: #999; font-size: 13px;">No commands yet</p>';
            return;
        }

        historyList.innerHTML = history.map(item => {
            const date = new Date(item.timestamp);
            return `
        <div class="history-item">
          <div class="command">"${item.command}"</div>
          <div class="timestamp">${date.toLocaleString()}</div>
        </div>
      `;
        }).join('');
    });
}

function displayImagePreview(fileOrBlob) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImg = document.getElementById('previewImg');
        previewImg.src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
    };

    if (fileOrBlob instanceof Blob) {
        reader.readAsDataURL(fileOrBlob);
    } else {
        reader.readAsDataURL(fileOrBlob);
    }
}

async function analyzeImage(imageDataUrl) {
    updateStatus('processing', 'Analyzing image...');
    document.getElementById('analyzeImageBtn').disabled = true;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'analyzeImage',
            imageData: imageDataUrl
        });

        if (response && response.analysis) {
            document.getElementById('analysisContent').textContent = response.analysis;
            document.getElementById('imageAnalysis').style.display = 'block';

            if (document.getElementById('enableTTS').checked) {
                speak(response.analysis);
            }
        } else {
            throw new Error('No analysis received');
        }
    } catch (error) {
        const msg = error?.message || String(error);
        alert(
            msg.includes('Proxy') || msg.includes('fetch')
                ? 'Image analysis failed. Is the proxy running? (npm start in ai-proxy). Set GEMINI_API_KEY in ai-proxy/.env'
                : 'Error analyzing image. Check the proxy and GEMINI_API_KEY in ai-proxy/.env'
        );
    } finally {
        updateStatus('ready', 'Ready to listen');
        document.getElementById('analyzeImageBtn').disabled = false;
    }
}

async function tryContentScriptRecognition() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('[POPUP DEBUG] Active tab:', tab?.id, tab?.url);
        if (!tab || !tab.id) {
            console.warn('[POPUP DEBUG] No active tab');
            return false;
        }

        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
            document.getElementById('response').textContent =
                '⚠️ Cannot use voice commands on Chrome internal pages.\n\n' +
                'Please navigate to a regular website (like google.com) and try again.';
            document.getElementById('responseBox').style.display = 'block';
            return false;
        }

        try {
            console.log('[POPUP DEBUG] Sending startSpeechRecognition to tab', tab.id);
            const result = await chrome.tabs.sendMessage(tab.id, {
                type: 'startSpeechRecognition'
            });
            console.log('[POPUP DEBUG] Content script response:', result);

            if (result && result.success) {
                return true;
            } else if (result && result.error) {
                handleSpeechError(result.error);
                return false;
            }
            return result !== undefined;
        } catch (error) {
            console.warn('[POPUP DEBUG] sendMessage failed:', error.message);
            if (error.message && error.message.includes('Could not establish connection')) {
                try {
                    console.log('[POPUP DEBUG] Injecting content script and retrying');
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/content.js']
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const retryResult = await chrome.tabs.sendMessage(tab.id, {
                        type: 'startSpeechRecognition'
                    });
                    console.log('[POPUP DEBUG] Retry response:', retryResult);

                    if (retryResult && retryResult.success) {
                        return true;
                    } else if (retryResult && retryResult.error) {
                        handleSpeechError(retryResult.error);
                        return false;
                    }
                    return retryResult !== undefined;
                } catch (injectError) {
                    console.error('[POPUP DEBUG] Injection failed:', injectError);
                    document.getElementById('response').textContent =
                        '⚠️ Could not start voice recognition on this page.\n\n' +
                        'Error: ' + injectError.message + '\n\n' +
                        '💡 Try:\n' +
                        '1. Refresh the page\n' +
                        '2. Navigate to a different website\n' +
                        '3. Check browser console (F12) for errors';
                    document.getElementById('responseBox').style.display = 'block';
                    return false;
                }
            } else {
                console.error('[POPUP DEBUG] Error:', error);
                document.getElementById('response').textContent =
                    '⚠️ Could not start voice recognition.\n\n' +
                    'Error: ' + (error.message || String(error)) + '\n\n' +
                    '💡 Check:\n' +
                    '1. Microphone permission in Chrome Settings\n' +
                    '2. Browser console (F12) for details\n' +
                    '3. Try refreshing the page';
                document.getElementById('responseBox').style.display = 'block';
                return false;
            }
        }
    } catch (error) {
        console.error('[POPUP DEBUG] tryContentScriptRecognition error:', error);
        return false;
    }
}

function handleSpeechResult(transcript) {
    console.log('[POPUP DEBUG] handleSpeechResult, transcript:', transcript);
    document.getElementById('transcript').textContent = transcript;
    document.getElementById('transcriptBox').style.display = 'block';
    document.getElementById('response').textContent = transcript + '\n\nProcessing...';
    document.getElementById('responseBox').style.display = 'block';
    updateStatus('processing', 'Processing command...');

    function finishListening() {
        updateStatus('ready', 'Ready to listen');
        document.getElementById('listenBtnText').textContent = 'Start Listening';
        document.getElementById('listenBtn').disabled = false;
        isListening = false;

        chrome.storage.local.get(['enableContinuousListening'], (result) => {
            if (result.enableContinuousListening) {
                setTimeout(() => {
                    if (!isListening && !isReading) {
                        tryContentScriptRecognition().catch(() => { });
                    }
                }, 500);
            }
        });
    }

    function applyExecutionResponse(response) {
        if (!response) return;
        let responseText = response.message || (response.error && String(response.error)) || 'Done.';
        if (response.description) {
            responseText = responseText + '\n\n' + response.description;
            document.getElementById('response').innerHTML =
                '<strong>' + (response.message || 'Page Description:') + '</strong><br><br>' +
                (response.description || '').replace(/\n/g, '<br>');
        } else {
            document.getElementById('response').textContent = responseText;
        }
        const stopReadingBtn = document.getElementById('stopReadingBtn');
        if (response.content && response.action === 'read_page') {
            lastReadPageTabId = response.tabId || null;
            // Show controls when read_page starts
            isReading = true;
            isPaused = false;
            stopReadingBtn.style.display = 'block';
            const pauseResumeBtn = document.getElementById('pauseResumeBtn');
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = '⏸️ Pause';
                pauseResumeBtn.title = 'Pause reading';
            }
            document.getElementById('playbackControls').classList.add('active');
            document.getElementById('progressDisplay').classList.add('active');
        } else {
            lastReadPageTabId = null;
            stopReadingBtn.style.display = 'none';
            if (document.getElementById('enableTTS').checked) {
                if (response.description) speak(response.description);
                else speak(responseText);
            }
        }
        saveCommandToHistory(transcript, responseText);
    }

    const fallback = typeof fallbackParse === 'function' ? fallbackParse(transcript) : { action: 'UNKNOWN' };
    console.log('[POPUP DEBUG] Fallback parse result:', fallback);

    if (fallback && fallback.action === 'READ_PAGE') {
        console.log('[POPUP DEBUG] READ_PAGE from fallback, sending EXECUTE_COMMAND:', fallback);
        chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command: fallback }, (execResponse) => {
            console.log('[POPUP DEBUG] EXECUTE_COMMAND response (READ_PAGE path):', execResponse);
            if (chrome.runtime.lastError) console.error('[POPUP DEBUG] lastError:', chrome.runtime.lastError);
            finishListening();
            applyExecutionResponse(execResponse);
        });
        return;
    }

    console.log('[POPUP DEBUG] Sending AI_PARSE_COMMAND');
    chrome.runtime.sendMessage({ type: 'AI_PARSE_COMMAND', text: transcript }, (response) => {
        console.log('[POPUP DEBUG] AI parse response:', response);
        if (chrome.runtime.lastError) console.error('[POPUP DEBUG] AI_PARSE lastError:', chrome.runtime.lastError);
        if (chrome.runtime.lastError || !response || !response.command) {
            console.log('[POPUP DEBUG] Using fallback command:', fallback);
            chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command: fallback }, (execResponse) => {
                console.log('[POPUP DEBUG] EXECUTE_COMMAND response (fallback):', execResponse);
                finishListening();
                applyExecutionResponse(execResponse);
            });
            return;
        }
        console.log('[POPUP DEBUG] Executing command:', response.command);
        chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command: response.command }, (execResponse) => {
            console.log('[POPUP DEBUG] EXECUTE_COMMAND response:', execResponse);
            finishListening();
            applyExecutionResponse(execResponse);
        });
    });
}

function handleSpeechError(error) {
    isListening = false;
    updateStatus('ready', 'Ready to listen');
    document.getElementById('listenBtnText').textContent = 'Start Listening';
    document.getElementById('listenBtn').disabled = false;

    if (error === 'not-allowed') {
        showPermissionInstructions({ name: 'NotAllowedError', message: 'not-allowed' });
    } else {
        document.getElementById('response').textContent = `Error: ${error}. Please try again.`;
        document.getElementById('responseBox').style.display = 'block';
    }
}

function showPermissionInstructions(error = null) {
    updateStatus('ready', 'Microphone permission denied');

    const errorName = error?.name || 'Permission denied';
    const errorMessage = error?.message || '';

    let instructions =
        '🔒 Microphone Access Required\n\n' +
        'Chrome has blocked microphone access for this extension.\n\n' +
        '📋 Quick Fix:\n\n' +
        '1. Click "Open Chrome Settings" button below\n' +
        '2. Find your extension in the list\n' +
        '3. Set microphone to "Allow"\n' +
        '4. Come back and reload this extension\n' +
        '5. Try "Start Listening" again\n\n' +
        '💡 Tip: Look for entries starting with "chrome-extension://"\n\n';

    if (errorName === 'NotAllowedError' || errorMessage.includes('not-allowed')) {
        instructions += '⚠️ Error: Permission was denied.\n';
        instructions += 'This is a Chrome security feature - you must manually allow it.';
    }

    document.getElementById('response').textContent = instructions;
    document.getElementById('responseBox').style.display = 'block';

    const settingsBtn = document.getElementById('openSettingsBtn');
    if (settingsBtn) {
        settingsBtn.style.display = 'block';
    }

    if (document.getElementById('enableTTS').checked) {
        speak('Microphone permission denied. Please enable microphone access in Chrome settings.');
    }
}

document.getElementById('enableTTS').addEventListener('change', (e) => {
    chrome.storage.local.set({ enableTTS: e.target.checked });
});

document.getElementById('enableContinuousListening').addEventListener('change', (e) => {
    chrome.storage.local.set({ enableContinuousListening: e.target.checked });
    if (e.target.checked && !isListening && !isReading) {
        setTimeout(() => {
            tryContentScriptRecognition().catch(() => { });
        }, 300);
    }
});

