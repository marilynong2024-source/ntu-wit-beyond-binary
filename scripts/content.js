if (typeof window.contentScriptInitialized === 'undefined') {
    window.contentScriptInitialized = true;

    window.contentRecognition = null;
    window.isReadingPage = false;
    window.speechChunks = [];
    window.currentChunkIndex = 0;
    window.lastSpeakCallTime = 0;
    window.isSpeakingChunks = false;

    // Listen for keyboard shortcuts directly (fallback when service worker is inactive)
    document.addEventListener('keydown', (e) => {
        // Option+Shift+S (Mac) or Alt+Shift+S (Windows/Linux) - Stop reading
        if ((e.altKey || e.metaKey) && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            e.stopPropagation();
            stopReadingCompletely();
        }
        // Option+Shift+R (Mac) or Alt+Shift+R (Windows/Linux) - Read page
        else if ((e.altKey || e.metaKey) && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            e.stopPropagation();
            console.log('[CONTENT] Read page shortcut pressed');
            
            // Prevent multiple simultaneous calls
            if (window.isReadingPage) {
                console.log('[CONTENT] Already reading, ignoring');
                return;
            }
            
            const result = readPageContent();
            const text = result.content || "Sorry, I can't find readable text on this page.";
            console.log('[CONTENT] Extracted text length:', text.length);
            
            if ('speechSynthesis' in window && text && text.trim()) {
                console.log('[CONTENT] speechSynthesis available');
                const synth = window.speechSynthesis;
                
                // CRITICAL: Create and speak the FIRST utterance IMMEDIATELY in the user interaction context
                // This must happen synchronously, without any async operations
                synth.cancel();
                window.isReadingPage = true;
                window.currentChunkIndex = 0;
                window.isSpeakingChunks = false;
                
                // Split text into chunks
                const trimmed = text.trim();
                window.speechChunks = trimmed.match(/.{1,800}(\s|$)/g) || [];
                console.log('[CONTENT] Created', window.speechChunks.length, 'speech chunks');
                
                if (window.speechChunks.length > 0) {
                    // Create and speak the FIRST chunk immediately in the user interaction context
                    const firstChunk = window.speechChunks[0];
                    const u = new SpeechSynthesisUtterance(firstChunk);
                    u.lang = "en-US";
                    u.rate = 1;
                    u.pitch = 1;
                    u.volume = 1;
                    
                    // Try to set a voice if available
                    const voices = synth.getVoices();
                    if (voices.length > 0) {
                        const englishVoice = voices.find(v => v.lang.startsWith("en"));
                        if (englishVoice) u.voice = englishVoice;
                    }
                    
                    console.log('[CONTENT] Speaking first chunk immediately in user interaction context');
                    u.onstart = () => {
                        console.log('[CONTENT] First chunk started speaking!');
                        window.isSpeakingChunks = true;
                    };
                    u.onend = () => {
                        console.log('[CONTENT] First chunk finished, continuing with remaining chunks');
                        if (window.isReadingPage && window.currentChunkIndex === 0) {
                            window.currentChunkIndex = 1;
                            // Now we can use the async function for remaining chunks
                            speakFromCurrentChunk();
                        }
                    };
                    u.onerror = (e) => {
                        // 'canceled' and 'interrupted' are not real errors - they mean we stopped it intentionally
                        if (e.error !== 'canceled' && e.error !== 'interrupted') {
                            console.error('[CONTENT] Error speaking first chunk:', e.error);
                            if (e.error === 'not-allowed') {
                                console.error('[CONTENT] Speech synthesis blocked: not-allowed');
                                console.error('[CONTENT] This should not happen with keyboard shortcuts.');
                                console.error('[CONTENT] Please ensure the browser tab has focus and try again.');
                                window.isReadingPage = false;
                                chrome.runtime.sendMessage({
                                    type: 'readPageError',
                                    error: 'Speech synthesis blocked. Please ensure the browser tab has focus and try again.'
                                }).catch(() => {});
                                return;
                            }
                            if (window.isReadingPage) {
                                window.currentChunkIndex = 1;
                                speakFromCurrentChunk();
                            }
                        }
                    };
                    
                    // SPEAK IMMEDIATELY - this must be in the same call stack as the keyboard event
                    synth.speak(u);
                    console.log('[CONTENT] synth.speak called for first chunk');
                    
                    // Set up the rest of the chunks for async continuation
                    chrome.runtime.sendMessage({ type: 'readPageStarted' }).catch(() => {});
                } else {
                    window.isReadingPage = false;
                }
            } else {
                if (!('speechSynthesis' in window)) {
                    console.error('[CONTENT] speechSynthesis not available in window');
                } else {
                    console.error('[CONTENT] No text to speak');
                }
            }
        }
        // Option+Shift+A (Mac) or Alt+Shift+A (Windows/Linux) - Activate assistant
        else if ((e.altKey || e.metaKey) && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            e.stopPropagation();
            const confirmationText = "Assistant active. Say 'read page' or press Alt+Shift+R.";
            if ('speechSynthesis' in window) {
                const synth = window.speechSynthesis;
                synth.cancel();
                const utterance = speakUtterance(confirmationText);
                if (utterance) {
                    utterance.onerror = (e) => {
                        // 'canceled' is not a real error
                        if (e.error !== 'canceled') {
                            console.error('[CONTENT] Error speaking activation:', e.error);
                        }
                    };
                    // Wait a moment after cancel() before speaking
                    setTimeout(() => {
                        try {
                            synth.speak(utterance);
                        } catch (err) {
                            console.error('[CONTENT] Error calling synth.speak for activation:', err);
                        }
                    }, 50);
                }
            }
        }
    }, true); // Use capture phase to catch before other handlers

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[CONTENT DEBUG] Message received:', request.type, request.action ?? '', request.params ?? '');
        // Handle startSpeechRecognition synchronously to avoid channel closing
        if (request.type === 'startSpeechRecognition') {
            try {
                const response = startContentSpeechRecognition();
                if (response) {
                    sendResponse(response);
                } else {
                    // Recognition started, send immediate success response
                    // Status updates will come via chrome.runtime.sendMessage
                    sendResponse({ success: true, status: 'starting' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true; // Indicate we handled it synchronously
        }

        // All other messages handled asynchronously
        (async () => {
            try {
                if (request.type === 'ACTIVATE_ASSISTANT') {
                    // Speak confirmation message
                    const confirmationText = "Assistant active. Say 'read page' or press Alt+Shift+R.";
                    if ('speechSynthesis' in window) {
                        const synth = window.speechSynthesis;
                        synth.cancel(); // Cancel any ongoing speech
                        const utterance = speakUtterance(confirmationText);
                        if (utterance) {
                            utterance.onerror = (e) => {
                                // 'canceled' is not a real error
                                if (e.error !== 'canceled') {
                                    console.error('[CONTENT] Error speaking activation:', e.error);
                                }
                            };
                            // Wait a moment after cancel() before speaking
                            setTimeout(() => {
                                try {
                                    synth.speak(utterance);
                                } catch (err) {
                                    console.error('[CONTENT] Error calling synth.speak for activation:', err);
                                }
                            }, 50);
                        }
                    }
                    sendResponse({ success: true });
                } else if (request.type === 'READ_PAGE') {
                    // Read page aloud
                    const result = readPageContent();
                    const text = result.content || "Sorry, I can't find readable text on this page.";
                    if ('speechSynthesis' in window && text && text.trim()) {
                        try {
                            speakInPage(text);
                        } catch (e) {
                            console.error('[CONTENT] Error speaking page:', e);
                        }
                    }
                    sendResponse({
                        success: true,
                        message: result.message,
                        content: result.content
                    });
                } else if (request.type === 'STOP_SPEECH' || request.type === 'stopReading') {
                    stopReadingCompletely();
                    sendResponse({ success: true });
                } else if (request.type === 'executeAction') {
                    console.log('[CONTENT DEBUG] executeAction:', request.action, request.params);
                    if (request.action === 'read_page') {
                        const result = readPageContent();
                        console.log('[CONTENT DEBUG] executeAction read_page result:', result.message, 'content length:', result.content?.length);
                        sendResponse({
                            success: true,
                            message: result.message,
                            content: result.content
                        });
                        return;
                    } else {
                        const result = await executeActionOnPage(request.action, request.params);
                        sendResponse({
                            success: true,
                            message: result.message,
                            description: result.description,
                            content: result.content
                        });
                    }
                } else if (request.type === 'speak') {
                    speakInPage(request.text || '');
                    sendResponse({ success: true });
                } else if (request.type === 'fastForward') {
                    fastForwardSpeech();
                    sendResponse({ success: true });
                } else if (request.type === 'rewind') {
                    rewindSpeech();
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Unknown request type' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    });

    function fastForwardSpeech() {
        if (!window.isReadingPage || window.speechChunks.length === 0) return;

        const synth = window.speechSynthesis;
        if (!synth) return;

        synth.cancel();
        window.isSpeakingChunks = false; // Clear flag so speakFromCurrentChunk can run
        setTimeout(() => {
            window.currentChunkIndex = Math.min(
                window.currentChunkIndex + 1,
                window.speechChunks.length - 1
            );
            chrome.runtime.sendMessage({
                type: 'speechProgress',
                current: window.currentChunkIndex + 1,
                total: window.speechChunks.length
            }).catch(() => { });
            speakFromCurrentChunk();
        }, 100);
    }

    function rewindSpeech() {
        if (!window.isReadingPage || window.speechChunks.length === 0) return;

        const synth = window.speechSynthesis;
        if (!synth) return;

        synth.cancel();
        window.isSpeakingChunks = false; // Clear flag so speakFromCurrentChunk can run
        setTimeout(() => {
            window.currentChunkIndex = Math.max(window.currentChunkIndex - 1, 0);
            chrome.runtime.sendMessage({
                type: 'speechProgress',
                current: window.currentChunkIndex + 1,
                total: window.speechChunks.length
            }).catch(() => { });
            speakFromCurrentChunk();
        }, 100);
    }

    function speakUtterance(str) {
        if (!str || typeof str !== 'string') {
            console.error('[CONTENT] Invalid string for speakUtterance:', str);
            return null;
        }
        const synth = window.speechSynthesis;
        if (!synth) {
            console.error('[CONTENT] speechSynthesis not available in speakUtterance');
            return null;
        }
        
        const u = new SpeechSynthesisUtterance(str);
        u.lang = "en-US";
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        
        // Get voices - force refresh if needed
        let voices = synth.getVoices();
        if (voices.length === 0) {
            // Try again after a short delay
            setTimeout(() => {
                voices = synth.getVoices();
            }, 0);
        }
        
        if (voices.length > 0) {
            const localVoice = voices.find(v => v.lang.startsWith("en") && v.localService);
            const englishVoice = voices.find(v => v.lang.startsWith("en"));
            const voice = localVoice || englishVoice || voices[0];
            if (voice) {
                u.voice = voice;
            }
        }
        // If no voices available, Chrome will use default voice
        
        return u;
    }

    function stopReadingCompletely() {
        // Set flag FIRST to prevent any new chunks from starting
        window.isReadingPage = false;
        window.isSpeakingChunks = false; // Clear speaking flag
        
        // Aggressively cancel all speech synthesis
        const synth = window.speechSynthesis;
        if (synth) {
            synth.cancel();
            synth.cancel();
            synth.cancel();
            
            // Force stop by canceling while speaking
            if (synth.speaking || synth.pending) {
                synth.cancel();
                setTimeout(() => {
                    if (synth.speaking || synth.pending) {
                        synth.cancel();
                        synth.cancel();
                    }
                }, 10);
            }
        }
        
        // Clear all state immediately
        window.speechChunks = [];
        window.currentChunkIndex = 0;
        
        // Notify that reading ended
        chrome.runtime.sendMessage({ type: 'readPageEnded' }).catch(() => {});
    }

    function speakFromCurrentChunk() {
        console.log('[CONTENT] speakFromCurrentChunk called, isReadingPage:', window.isReadingPage, 'chunks:', window.speechChunks.length, 'isSpeakingChunks:', window.isSpeakingChunks);
        
        // Prevent multiple simultaneous calls
        if (window.isSpeakingChunks) {
            console.log('[CONTENT] Already speaking chunks, ignoring duplicate call');
            return;
        }
        
        // Check flag at the start - exit immediately if stopped
        if (!window.isReadingPage || window.speechChunks.length === 0) {
            console.log('[CONTENT] speakFromCurrentChunk aborted: isReadingPage=', window.isReadingPage, 'chunks=', window.speechChunks.length);
            return;
        }

        const synth = window.speechSynthesis;
        if (!synth) {
            console.error('[CONTENT] speechSynthesis not available in speakFromCurrentChunk');
            return;
        }
        
        // Set flag to prevent concurrent calls
        window.isSpeakingChunks = true;

        function speakNext() {
            console.log('[CONTENT] speakNext called, chunk', window.currentChunkIndex, 'of', window.speechChunks.length);
            // Check flag at every step - exit immediately if stopped
            if (!window.isReadingPage || window.currentChunkIndex >= window.speechChunks.length) {
                console.log('[CONTENT] speakNext finished all chunks');
                window.isReadingPage = false;
                window.speechChunks = [];
                window.currentChunkIndex = 0;
                window.isSpeakingChunks = false; // Clear flag when done
                chrome.runtime.sendMessage({ type: 'readPageEnded' }).catch(() => { });
                return;
            }

            const chunkText = window.speechChunks[window.currentChunkIndex];
            if (!chunkText || !chunkText.trim()) {
                console.log('[CONTENT] Empty chunk, skipping');
                window.currentChunkIndex++;
                speakNext();
                return;
            }
            
            console.log('[CONTENT] Speaking chunk', window.currentChunkIndex + 1, 'length:', chunkText.length);
            const u = speakUtterance(chunkText);
            if (!u) {
                console.error('[CONTENT] Failed to create utterance for chunk');
                window.currentChunkIndex++;
                speakNext();
                return;
            }
            
            const speakingIndex = window.currentChunkIndex;
            let chunkStarted = false;
            let chunkFinished = false;

            u.onstart = () => {
                chunkStarted = true;
                console.log('[CONTENT] Chunk', speakingIndex + 1, 'started speaking');
                if (!window.isReadingPage) {
                    synth.cancel();
                    window.isSpeakingChunks = false;
                    return;
                }
                chrome.runtime.sendMessage({
                    type: 'speechProgress',
                    current: speakingIndex + 1,
                    total: window.speechChunks.length
                }).catch(() => { });
            };

            u.onend = () => {
                chunkFinished = true;
                console.log('[CONTENT] Chunk', speakingIndex + 1, 'finished');
                if (!window.isReadingPage) {
                    window.isSpeakingChunks = false;
                    return;
                }
                // Only continue if this is still the current chunk (hasn't been skipped)
                if (window.currentChunkIndex === speakingIndex) {
                    window.currentChunkIndex++;
                    speakNext();
                } else {
                    console.log('[CONTENT] Chunk', speakingIndex + 1, 'finished but was skipped, current chunk:', window.currentChunkIndex);
                }
            };

            u.onerror = (e) => {
                console.log('[CONTENT] Chunk', speakingIndex + 1, 'error:', e.error);
                // 'canceled' and 'interrupted' are not real errors - they mean we stopped it intentionally
                if (e.error !== 'canceled' && e.error !== 'interrupted') {
                    console.error('[CONTENT] Error speaking chunk', speakingIndex + 1, ':', e.error);
                    
                    // Handle 'not-allowed' error - Chrome blocks speech synthesis without user interaction
                    if (e.error === 'not-allowed') {
                        console.error('[CONTENT] Speech synthesis blocked: not-allowed');
                        console.error('[CONTENT] Chrome requires user interaction to start speech synthesis.');
                        console.error('[CONTENT] Voice commands cannot trigger speech synthesis.');
                        console.error('[CONTENT] Please use the keyboard shortcut: Alt+Shift+R (or Option+Shift+R on Mac)');
                        
                        // Stop trying to speak
                        window.isReadingPage = false;
                        window.isSpeakingChunks = false;
                        window.speechChunks = [];
                        window.currentChunkIndex = 0;
                        
                        // Notify user via message
                        chrome.runtime.sendMessage({
                            type: 'readPageError',
                            error: 'Speech synthesis requires keyboard shortcut. Please press Alt+Shift+R (or Option+Shift+R on Mac) to read the page.'
                        }).catch(() => {});
                        
                        return;
                    }
                }
                if (!window.isReadingPage) {
                    window.isSpeakingChunks = false;
                    return;
                }
                // Only continue if this is still the current chunk (hasn't been skipped)
                // Skip 'interrupted' errors - they're expected when user controls playback
                if (e.error !== 'interrupted' && window.currentChunkIndex === speakingIndex && !chunkFinished) {
                    window.currentChunkIndex++;
                    speakNext();
                }
            };

            try {
                console.log('[CONTENT] Calling synth.speak for chunk', speakingIndex + 1, 'speaking:', synth.speaking, 'pending:', synth.pending);
                
                // Ensure we're not already speaking something else
                if (synth.speaking || synth.pending) {
                    console.log('[CONTENT] Already speaking or pending, canceling previous speech');
                    synth.cancel();
                    // Wait a moment for cancel to complete
                    setTimeout(() => {
                        if (window.isReadingPage && window.currentChunkIndex === speakingIndex) {
                            console.log('[CONTENT] Retrying synth.speak after cancel');
                            synth.speak(u);
                            console.log('[CONTENT] synth.speak called for chunk', speakingIndex + 1, 'after cancel');
                        }
                    }, 100);
                } else {
                    console.log('[CONTENT] Speaking chunk', speakingIndex + 1, 'immediately');
                    synth.speak(u);
                    console.log('[CONTENT] synth.speak called for chunk', speakingIndex + 1);
                    
                    // Immediately check if it started (within the same event loop)
                    setTimeout(() => {
                        if (window.isReadingPage && window.currentChunkIndex === speakingIndex) {
                            console.log('[CONTENT] After 10ms - speaking:', synth.speaking, 'pending:', synth.pending, 'chunkStarted:', chunkStarted);
                            if (!synth.speaking && !synth.pending && !chunkStarted) {
                                console.error('[CONTENT] Speech did not start! This may indicate Chrome speech synthesis is blocked or not working.');
                                console.error('[CONTENT] Possible causes:');
                                console.error('[CONTENT] 1. System audio is muted');
                                console.error('[CONTENT] 2. Chrome permissions block speech synthesis');
                                console.error('[CONTENT] 3. User interaction context was lost');
                                console.error('[CONTENT] 4. Chrome speech synthesis is not available on this system');
                            }
                        }
                    }, 10);
                }
                
                // Verify speech actually started after a brief delay
                setTimeout(() => {
                    if (window.isReadingPage && window.currentChunkIndex === speakingIndex && !chunkStarted && !chunkFinished) {
                        if (!synth.speaking && !synth.pending) {
                            console.warn('[CONTENT] Chunk', speakingIndex + 1, 'did not start speaking after 500ms, trying again');
                            // Speech didn't start, try speaking again
                            try {
                                synth.cancel();
                                setTimeout(() => {
                                    if (window.isReadingPage && window.currentChunkIndex === speakingIndex) {
                                        synth.speak(u);
                                    }
                                }, 100);
                            } catch (e) {
                                console.error('[CONTENT] Error retrying speech:', e);
                                window.currentChunkIndex++;
                                speakNext();
                            }
                        } else {
                            console.log('[CONTENT] Chunk', speakingIndex + 1, 'is speaking or pending');
                        }
                    }
                }, 500);
            } catch (e) {
                console.error('[CONTENT] Error calling synth.speak for chunk:', e);
                window.currentChunkIndex++;
                speakNext();
            }
        }

        speakNext();
    }

    function startContentSpeechRecognition() {
        console.log('[CONTENT DEBUG] startContentSpeechRecognition called');
        // Return null to indicate async handling (response sent via chrome.runtime.sendMessage)
        // The caller will send an immediate response
        
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            // Stop any existing recognition first
            if (window.contentRecognition) {
                try {
                    window.contentRecognition.stop();
                } catch (e) {
                    // Ignore errors when stopping
                }
            }
            
            window.contentRecognition = new SpeechRecognition();
            window.contentRecognition.continuous = false;
            window.contentRecognition.interimResults = false;
            window.contentRecognition.lang = 'en-US';

            window.contentRecognition.onstart = () => {
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionStatus',
                    status: 'listening'
                }).catch(() => {});
            };

            window.contentRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                console.log('[CONTENT DEBUG] Speech result transcript:', transcript);
                processCommandLocally(transcript);
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionResult',
                    transcript: transcript
                }).catch(() => {});
            };

            window.contentRecognition.onerror = (event) => {
                console.error('[CONTENT] Speech recognition error:', event.error);
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionError',
                    error: event.error
                }).catch(() => {});
            };

            window.contentRecognition.onend = () => {
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionStatus',
                    status: 'ended'
                }).catch(() => {});
            };

            try {
                window.contentRecognition.start();
                return null;
            } catch (error) {
                console.error('[CONTENT] Error starting recognition:', error);
                return { success: false, error: error.message || 'Failed to start recognition' };
            }
        } else {
            console.error('[CONTENT] Speech recognition not supported');
            return { success: false, error: 'Speech recognition not supported in this browser' };
        }
    }

    async function executeActionOnPage(action, params = {}) {
        switch (action) {
            case 'scroll_down':
                window.scrollBy({
                    top: 300,
                    behavior: 'smooth'
                });
                return { message: 'Scrolled down' };

            case 'scroll_up':
                window.scrollBy({
                    top: -300,
                    behavior: 'smooth'
                });
                return { message: 'Scrolled up' };

            case 'scroll_to_top':
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return { message: 'Scrolled to top' };

            case 'scroll_to_bottom':
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                return { message: 'Scrolled to bottom' };

            case 'go_back':
                window.history.back();
                return { message: 'Navigated back' };

            case 'go_forward':
                window.history.forward();
                return { message: 'Navigated forward' };

            case 'refresh':
                window.location.reload();
                return { message: 'Page refreshed' };

            case 'click_element':
                return clickElementByName(params.elementName);

            case 'read_page':
                return readPageContent();

            case 'search':
                return performSearch(params.query);

            case 'open_website':
                if (params.url) {
                    window.location.href = params.url;
                    return { message: `Opening ${params.url}` };
                }
                throw new Error('No URL provided');

            case 'enlarge_click_targets':
                return enlargeClickTargets();

            case 'increase_target_size':
                return increaseTargetSize();

            case 'decrease_target_size':
                return decreaseTargetSize();

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    function clickElementByName(elementName) {
        const allElements = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
        const searchTerm = elementName.toLowerCase().trim();

        if (!searchTerm || searchTerm.length < 2) {
            throw new Error('No element name provided');
        }

        if (searchTerm === 'on' || searchTerm === 'the' || searchTerm.length < 3) {
            throw new Error(`Search term "${elementName}" is too short or ambiguous. Please be more specific (e.g., "click diseases and parasites" instead of "click on").`);
        }

        const normalizeText = (str) => {
            return (str || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
        };

        const searchTermNormalized = normalizeText(searchTerm);
        const searchWords = searchTermNormalized.split(/\s+/).filter(w => w.length > 0);

        if (searchWords.length === 0) {
            throw new Error('Invalid element name');
        }

        const matches = [];

        Array.from(allElements).forEach(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = rect.width > 0 && rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                style.opacity !== '0';

            if (!isVisible) return;

            const text = (el.textContent || '').trim();
            const ariaLabel = (el.getAttribute('aria-label') || '').trim();
            const title = (el.getAttribute('title') || '').trim();
            const id = (el.id || '').trim();
            const name = (el.name || '').trim();

            const textNormalized = normalizeText(text);
            const ariaLabelNormalized = normalizeText(ariaLabel);
            const titleNormalized = normalizeText(title);
            const idNormalized = normalizeText(id);
            const nameNormalized = normalizeText(name);

            const allTexts = [textNormalized, ariaLabelNormalized, titleNormalized, idNormalized, nameNormalized].filter(t => t.length > 0);
            if (allTexts.length === 0) return;

            let score = 0;
            let matchType = '';
            let matchedText = '';

            for (const candidateText of allTexts) {
                if (candidateText === searchTermNormalized) {
                    score = 1000;
                    matchType = 'exact';
                    matchedText = candidateText;
                    break;
                }
            }

            if (score === 0) {
                const escapedTerm = searchTermNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordBoundaryRegex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

                for (const candidateText of allTexts) {
                    if (wordBoundaryRegex.test(candidateText)) {
                        score = 500;
                        matchType = 'word-boundary';
                        matchedText = candidateText;
                        break;
                    }
                }
            }

            if (score === 0 && searchWords.length > 1) {
                const allWordsMatch = searchWords.every(word => {
                    const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    return allTexts.some(t => wordRegex.test(t));
                });

                if (allWordsMatch) {
                    score = 400;
                    matchType = 'multi-word';
                    matchedText = allTexts[0];
                }
            }

            if (score === 0 && searchTermNormalized.length >= 4) {
                const startsWithMatch = allTexts.find(t => t.startsWith(searchTermNormalized));
                if (startsWithMatch) {
                    score = 200;
                    matchType = 'starts-with';
                    matchedText = startsWithMatch;
                }
            }

            if (score === 0) {
                return;
            }

            const elementType = el.tagName.toLowerCase();
            const href = el.getAttribute('href') || '';
            const isPDFLink = href.toLowerCase().endsWith('.pdf') || href.toLowerCase().includes('.pdf') || textNormalized.includes('pdf');
            const isDownloadLink = href.toLowerCase().includes('download') || el.hasAttribute('download');
            const isInternalAnchor = href.startsWith('#') || href === '' || (href.startsWith('/') && !href.startsWith('//'));
            const isExternalLink = href.startsWith('http') && !href.includes(window.location.hostname);
            const isSectionHeader = el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4' || el.tagName === 'H5' || el.tagName === 'H6' || el.closest('h1, h2, h3, h4, h5, h6');
            const isTableOfContents = el.closest('.toc, #toc, .mw-parser-output .toc, .vector-toc, nav[role="navigation"]') !== null;
            const isNavigationLink = isTableOfContents || el.closest('nav') !== null || el.getAttribute('role') === 'navigation';
            const isScrollToAnchor = href.startsWith('#') && (el.closest('nav, .toc, #toc') !== null || isTableOfContents);

            if (elementType === 'button' || elementType === 'input') {
                score += 150;
            } else if (elementType === 'a') {
                if (isPDFLink || isDownloadLink) {
                    score -= 500;
                } else if (isScrollToAnchor) {
                    score -= 400;
                } else if (isNavigationLink || isTableOfContents) {
                    score -= 300;
                } else if (isInternalAnchor) {
                    score -= 150;
                } else if (isExternalLink) {
                    score += 100;
                } else {
                    score += 30;
                }
            }

            if (isSectionHeader || isTableOfContents || isNavigationLink) {
                score -= 300;
            }

            const isInMainContent = el.closest('main, article, [role="main"], .mw-parser-output, .mw-content-container, #content, .content') !== null;
            if (isInMainContent && !isNavigationLink && !isTableOfContents) {
                score += 150;
            }

            if (isPDFLink || isDownloadLink) {
                score -= 300;
            }

            const textLength = textNormalized.length;
            const searchLength = searchTermNormalized.length;
            if (textLength > 0 && Math.abs(textLength - searchLength) < 15) {
                score += 50;
            }

            if (textNormalized.includes(searchTermNormalized) && !isPDFLink) {
                if (isExternalLink && searchTermNormalized.includes('external')) {
                    score += 200;
                } else {
                    score += 100;
                }
            }

            const isInViewport = rect.top >= 0 && rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth;
            if (isInViewport) {
                score += 100;
            }

            score -= Math.max(0, rect.top) / 20;

            const displayText = text || ariaLabel || title || id || name || '';
            matches.push({ element: el, score, matchType, text: displayText, matchedText, isPDFLink, href, isExternalLink, isInternalAnchor, isTableOfContents, isNavigationLink, isInMainContent: isInMainContent });
        });

        if (matches.length === 0) {
            throw new Error(`Could not find element: ${elementName}`);
        }

        matches.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.isPDFLink !== b.isPDFLink) return a.isPDFLink ? 1 : -1;
            if (a.isTableOfContents !== b.isTableOfContents) return a.isTableOfContents ? 1 : -1;
            if (a.isNavigationLink !== b.isNavigationLink) return a.isNavigationLink ? 1 : -1;
            if (a.isInMainContent !== b.isInMainContent) return b.isInMainContent ? 1 : -1;
            return a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top;
        });

        const externalLinkMatches = matches.filter(m => m.isExternalLink && !m.isPDFLink && !m.isTableOfContents && !m.isNavigationLink);
        const contentMatches = matches.filter(m => !m.isPDFLink && !m.isTableOfContents && !m.isNavigationLink && !m.isScrollToAnchor);
        const nonPDFMatches = matches.filter(m => !m.isPDFLink);
        const PDFMatches = matches.filter(m => m.isPDFLink);

        let finalMatch = null;

        if (searchTermNormalized.includes('external')) {
            if (externalLinkMatches.length > 0) {
                finalMatch = externalLinkMatches[0];
            } else {
                const allExternalLinks = Array.from(document.querySelectorAll('a[href^="http"]')).filter(a => {
                    const href = a.getAttribute('href') || '';
                    return href.startsWith('http') && !href.includes(window.location.hostname) && !href.toLowerCase().endsWith('.pdf');
                }).filter(a => {
                    const rect = a.getBoundingClientRect();
                    const style = window.getComputedStyle(a);
                    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                });

                if (allExternalLinks.length > 0) {
                    const firstExternal = allExternalLinks[0];
                    const text = (firstExternal.textContent || '').trim();
                    finalMatch = {
                        element: firstExternal,
                        score: 100,
                        text: text,
                        isPDFLink: false,
                        isExternalLink: true,
                        isTableOfContents: false,
                        isNavigationLink: false
                    };
                }
            }
        }

        if (!finalMatch && contentMatches.length > 0) {
            finalMatch = contentMatches[0];
        }

        if (!finalMatch && nonPDFMatches.length > 0) {
            const bestNonPDF = nonPDFMatches[0];
            if (PDFMatches.length > 0) {
                const bestPDF = PDFMatches[0];
                if (bestNonPDF.score >= bestPDF.score - 200 || bestNonPDF.score >= 200) {
                    finalMatch = bestNonPDF;
                } else {
                    finalMatch = bestNonPDF;
                }
            } else {
                finalMatch = bestNonPDF;
            }
        } else if (matches.length > 0) {
            finalMatch = matches[0];
        }

        if (!finalMatch && matches.length > 0) {
            const bestAvailable = matches[0];
            if (bestAvailable.score >= -200) {
                finalMatch = bestAvailable;
            }
        }

        if (!finalMatch) {
            throw new Error(`Could not find a good match for: ${elementName}`);
        }

        finalMatch.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            finalMatch.element.click();
        }, 100);

        return { message: `Clicked "${finalMatch.text || elementName}"` };
    }

    function processCommandLocally(transcript) {
        const text = (transcript || '').toLowerCase().trim();
        console.log('[CONTENT DEBUG] processCommandLocally:', transcript, '-> normalized:', text);

        // Handle read page commands
        if (text.includes("read page") || text.includes("read this page") || text.includes("read the page") ||
            text.includes("read aloud") || text.includes("read article") || text.includes("read the article") ||
            text.includes("speak page") || text.includes("speak this") || text.includes("read text")) {
            console.log('[CONTENT DEBUG] processCommandLocally: read-page branch');
            const result = readPageContent();
            const pageText = result.content || "Sorry, I can't find readable text on this page.";
            console.log('[CONTENT DEBUG] readPageContent result length:', pageText?.length);
            if ('speechSynthesis' in window && pageText && pageText.trim()) {
                try {
                    speakInPage(pageText);
                    chrome.runtime.sendMessage({ type: 'readPageStarted' }).catch(() => {});
                } catch (e) {
                    console.error('[CONTENT] Error in speakInPage:', e);
                }
            }
        }
        // Handle stop reading commands
        else if (text.includes("stop reading") || text.includes("stop speaking") || text.includes("pause reading") ||
                 text.includes("stop read") || text.includes("stop the reading") || text.includes("cancel reading")) {
            console.log('[CONTENT DEBUG] processCommandLocally: stop-reading branch');
            stopReadingCompletely();
        }
        // Handle scroll commands
        else if (text.includes("scroll down")) {
            window.scrollBy({ top: 300, behavior: 'smooth' });
        }
        else if (text.includes("scroll up")) {
            window.scrollBy({ top: -300, behavior: 'smooth' });
        }
        else if (text.includes("go to top") || text.includes("scroll to top")) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        else if (text.includes("go to bottom") || text.includes("scroll to bottom")) {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        // Handle navigation
        else if (text.includes("go back") || text.includes("back")) {
            window.history.back();
        }
        else if (text.includes("go forward") || text.includes("forward")) {
            window.history.forward();
        }
        else if (text.includes("refresh") || text.includes("reload")) {
            window.location.reload();
        }
        else {
            console.log('[CONTENT DEBUG] processCommandLocally: forwarding to background (speechRecognitionResult)');
            // For complex commands, try background script
            chrome.runtime.sendMessage({
                type: 'speechRecognitionResult',
                transcript: transcript
            }).catch(() => {});
        }
    }

    function readPageContent() {
        const mainContent = document.querySelector('main, article, [role="main"]') ||
            document.querySelector('.content, .main-content, #content') ||
            document.body;
        const clone = mainContent.cloneNode(true);
        const scripts = clone.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement');
        scripts.forEach(el => el.remove());

        const text = clone.textContent || clone.innerText || '';
        const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 5000);
        const content = cleanText || "Sorry, I can't find readable text on this page.";
        console.log('[CONTENT DEBUG] readPageContent:', content.length, 'chars');

        return {
            message: `Reading page content (${content.length} characters)`,
            content
        };
    }

    function speakInPage(text) {
        console.log('[CONTENT] speakInPage called with text length:', text ? text.length : 0);
        
        // Debounce: prevent calls within 500ms of each other
        const now = Date.now();
        if (now - window.lastSpeakCallTime < 500) {
            console.log('[CONTENT] Too soon after last call, ignoring');
            return;
        }
        window.lastSpeakCallTime = now;
        
        // Prevent multiple simultaneous calls - check and set atomically
        if (window.isReadingPage) {
            console.log('[CONTENT] Already reading, ignoring duplicate call');
            return;
        }
        
        // Set flag IMMEDIATELY to prevent race conditions
        window.isReadingPage = true;
        
        if (typeof text !== 'string' || !text.trim()) {
            console.error('[CONTENT] Invalid text for speakInPage:', text);
            window.isReadingPage = false;
            return;
        }
        const synth = window.speechSynthesis;
        if (!synth) {
            console.error('[CONTENT] speechSynthesis not available');
            window.isReadingPage = false;
            chrome.runtime.sendMessage({
                type: 'readPageError',
                error: 'speechSynthesis not available'
            }).catch(() => { });
            return;
        }

        console.log('[CONTENT] speechSynthesis available, voices count:', synth.getVoices().length);
        
        window.currentChunkIndex = 0;
        
        // Cancel any ongoing speech and wait a moment for it to clear
        synth.cancel();
        
        chrome.runtime.sendMessage({ type: 'readPageStarted' }).catch(() => { });

        function startSpeaking() {
            console.log('[CONTENT] startSpeaking called, isReadingPage:', window.isReadingPage);
            if (!window.isReadingPage) {
                console.log('[CONTENT] startSpeaking aborted: isReadingPage is false');
                return;
            }
            
            const trimmed = text.trim();
            console.log('[CONTENT] Trimmed text length:', trimmed.length);
            // Split into chunks of ~800 characters
            window.speechChunks = trimmed.match(/.{1,800}(\s|$)/g) || [];
            console.log('[CONTENT] Created', window.speechChunks.length, 'speech chunks');

            if (window.speechChunks.length === 0 || !window.isReadingPage) {
                console.log('[CONTENT] No chunks or reading stopped, exiting');
                window.isReadingPage = false;
                window.speechChunks = [];
                chrome.runtime.sendMessage({ type: 'readPageEnded' }).catch(() => { });
                return;
            }

            // Send initial progress update
            chrome.runtime.sendMessage({
                type: 'speechProgress',
                current: 1,
                total: window.speechChunks.length
            }).catch(() => { });

            // Skip intro and go straight to content for more reliable speech
            console.log('[CONTENT] Starting to speak chunks directly (skipping intro)');
            // Start speaking immediately - we're still in the user interaction context
            // Chrome requires speech to start in the same interaction context as the user action
            // NOTE: Don't cancel here - we already canceled in speakInPage()
            if (window.isReadingPage) {
                // Start speaking chunks immediately (no setTimeout to preserve user interaction context)
                speakFromCurrentChunk();
            }
        }

        // CRITICAL: Start speaking IMMEDIATELY to preserve user interaction context
        // Chrome requires speech to start in the same user interaction context
        // Don't wait for voices - Chrome will use a default voice if needed
        console.log('[CONTENT] Starting speech immediately (preserving user interaction context)');
        startSpeaking();
    }

    function performSearch(query) {
        const searchInputs = document.querySelectorAll('input[type="search"], input[name*="search" i], input[id*="search" i], input[placeholder*="search" i]');

        if (searchInputs.length > 0) {
            const searchInput = searchInputs[0];
            searchInput.value = query;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            const form = searchInput.closest('form');
            if (form) {
                form.submit();
            } else {
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            }

            return { message: `Searched for: ${query}` };
        }

        throw new Error('Could not find search input on this page');
    }

    // ==========================================
    // MOTOR IMPAIRMENT FEATURES
    // ==========================================

    // Larger click targets
    // Initialize zoom level (1.0 = original size, can't go below this)
    if (typeof window.targetSizeLevel === 'undefined') {
        window.targetSizeLevel = 1.0;
    }

    function increaseTargetSize() {
        // Increase by 0.2 (20%) each time, max 2.0 (200%)
        window.targetSizeLevel = Math.min(window.targetSizeLevel + 0.2, 2.0);
        applyTargetSizeStyle();

        const percentage = Math.round(window.targetSizeLevel * 100);
        return { message: `Size increased to ${percentage}%` };
    }

    // function decreaseTargetSize() {
    //     // Decrease by 0.2 (20%) each time, minimum 1.0 (100% - original)
    //     window.targetSizeLevel = Math.max(window.targetSizeLevel - 0.2, 1.0);
    //     applyTargetSizeStyle();

    //     const percentage = Math.round(window.targetSizeLevel * 100);
    //     if (window.targetSizeLevel === 1.0) {
    //         return { message: 'Reset to original size (100%)' };
    //     }
    //     return { message: `Size decreased to ${percentage}%` };
    // }

    function decreaseTargetSize() {
        // Check if already at minimum before decreasing
        const wasAtMinimum = window.targetSizeLevel === 1.0;
        
        // Decrease by 0.2 (20%) each time, minimum 1.0 (100% - original)
        window.targetSizeLevel = Math.max(window.targetSizeLevel - 0.2, 1.0);
        applyTargetSizeStyle();
        
        const percentage = Math.round(window.targetSizeLevel * 100);
        
        // Show warning if trying to go below minimum
        if (wasAtMinimum) {
            showNotification('⚠️ This is the minimum size (original 100%). Cannot decrease further.');
            return { message: 'Already at minimum size (100%)', atMinimum: true };
        }
        
        if (window.targetSizeLevel === 1.0) {
            return { message: 'Reset to original size (100%)', atMinimum: true };
        }
        return { message: `Size decreased to ${percentage}%`, atMinimum: false };
    }
    
    function showNotification(message) {
        // Remove any existing notification
        const existing = document.getElementById('accessibility-notification');
        if (existing) {
            existing.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'accessibility-notification';
        notification.className = 'notification-popup';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 500); // Wait for fade-out animation
        }, 5000);
    }

    function applyTargetSizeStyle() {
        // Remove existing style if present
        const existingStyle = document.getElementById('target-size-style');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Don't add style if at original size (1.0)
        if (window.targetSizeLevel === 1.0) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'target-size-style';

        const baseFontSize = 16 * window.targetSizeLevel;
        const minWidth = 48 * window.targetSizeLevel;
        const minHeight = 48 * window.targetSizeLevel;
        const padding = 12 * window.targetSizeLevel;

        style.textContent = `
        /* Enlarge clickable elements */
        button, a, input[type="button"], input[type="submit"], [role="button"] {
            min-width: ${minWidth}px !important;
            min-height: ${minHeight}px !important;
            padding: ${padding}px !important;
            font-size: ${baseFontSize}px !important;
            line-height: 1.5 !important;
        }
        
        /* Also enlarge general text for readability */
        body, p, li, div, span {
            font-size: ${baseFontSize}px !important;
            line-height: 1.6 !important;
        }
        
        /* Headings */
        h1 { font-size: ${baseFontSize * 2}px !important; }
        h2 { font-size: ${baseFontSize * 1.75}px !important; }
        h3 { font-size: ${baseFontSize * 1.5}px !important; }
    `;

        document.head.appendChild(style);
    }


}