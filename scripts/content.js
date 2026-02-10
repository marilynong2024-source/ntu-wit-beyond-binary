if (typeof window.contentScriptInitialized === 'undefined') {
    window.contentScriptInitialized = true;

    window.contentRecognition = null;
    window.isReadingPage = false;
    window.speechChunks = [];
    window.currentChunkIndex = 0;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        (async () => {
            try {
                console.log('[CONTENT DEBUG] Received message:', request.type, request.action, request.params);
                if (request.type === 'executeAction') {
                    if (request.action === 'read_page') {
                        const result = readPageContent();
                        const text = result.content || "Sorry, I can't find readable text on this page.";
                        if ('speechSynthesis' in window && text && text.trim()) {
                            try {
                                speakInPage(text);
                            } catch (e) {
                            }
                        }
                        sendResponse({
                            success: true,
                            message: result.message,
                            content: result.content
                        });
                    } else {
                        console.log('[CONTENT DEBUG] Executing action:', request.action, 'with params:', request.params);
                        const result = await executeActionOnPage(request.action, request.params);
                        console.log('[CONTENT DEBUG] Action result:', result);
                        sendResponse({
                            success: true,
                            message: result.message,
                            description: result.description,
                            content: result.content
                        });
                    }
                } else if (request.type === 'startSpeechRecognition') {
                    startContentSpeechRecognition(sendResponse);
                } else if (request.type === 'speak') {
                    speakInPage(request.text || '');
                    sendResponse({ success: true });
                } else if (request.type === 'stopReading') {
                    window.isReadingPage = false;
                    window.speechChunks = [];
                    window.currentChunkIndex = 0;
                    if (window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                        chrome.runtime.sendMessage({ type: 'readPageEnded' }).catch(() => { });
                    }
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
        if (!window.isReadingPage || window.speechChunks.length === 0) {
            console.log('[FF DEBUG] Cannot fast forward - not reading or no chunks');
            return;
        }

        const synth = window.speechSynthesis;
        if (!synth) return;

        console.log('[FF DEBUG] Current index before FF:', window.currentChunkIndex);

        // Cancel current speech first
        synth.cancel();

        // Small delay to ensure cancel completes
        setTimeout(() => {
            // Skip forward by 1 chunk (or to the end)
            const oldIndex = window.currentChunkIndex;
            window.currentChunkIndex = Math.min(
                window.currentChunkIndex + 1,
                window.speechChunks.length - 1
            );

            console.log('[FF DEBUG] Skipped from', oldIndex, 'to', window.currentChunkIndex);

            // Send progress update
            chrome.runtime.sendMessage({
                type: 'speechProgress',
                current: window.currentChunkIndex + 1,
                total: window.speechChunks.length
            }).catch(() => { });

            // Resume from new position
            speakFromCurrentChunk();
        }, 100);
    }

    function rewindSpeech() {
        if (!window.isReadingPage || window.speechChunks.length === 0) {
            console.log('[RW DEBUG] Cannot rewind - not reading or no chunks');
            return;
        }

        const synth = window.speechSynthesis;
        if (!synth) return;

        console.log('[RW DEBUG] Current index before rewind:', window.currentChunkIndex);

        // Cancel current speech first
        synth.cancel();

        // Small delay to ensure cancel completes
        setTimeout(() => {
            // Skip backward by 1 chunk (or to the beginning)
            const oldIndex = window.currentChunkIndex;
            window.currentChunkIndex = Math.max(window.currentChunkIndex - 1, 0);

            console.log('[RW DEBUG] Rewound from', oldIndex, 'to', window.currentChunkIndex);

            // Send progress update
            chrome.runtime.sendMessage({
                type: 'speechProgress',
                current: window.currentChunkIndex + 1,
                total: window.speechChunks.length
            }).catch(() => { });

            // Resume from new position
            speakFromCurrentChunk();
        }, 100);
    }

    function speakUtterance(str) {
        const synth = window.speechSynthesis;
        const u = new SpeechSynthesisUtterance(str);
        u.lang = "en-US";
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        const voices = synth.getVoices();
        const localVoice = voices.find(v => v.lang.startsWith("en") && v.localService);
        const englishVoice = voices.find(v => v.lang.startsWith("en"));
        const voice = localVoice || englishVoice || voices[0];
        if (voice) {
            u.voice = voice;
        }
        return u;
    }

    function speakFromCurrentChunk() {
        if (!window.isReadingPage || window.speechChunks.length === 0) {
            return;
        }

        const synth = window.speechSynthesis;
        if (!synth) return;

        function speakNext() {
            if (!window.isReadingPage || window.currentChunkIndex >= window.speechChunks.length) {
                window.isReadingPage = false;
                window.speechChunks = [];
                window.currentChunkIndex = 0;
                chrome.runtime.sendMessage({ type: 'readPageEnded' }).catch(() => { });
                return;
            }

            console.log('[SPEAK DEBUG] Speaking chunk', window.currentChunkIndex + 1, 'of', window.speechChunks.length);
            const u = speakUtterance(window.speechChunks[window.currentChunkIndex]);

            // Store the index we're about to speak so we can detect if it changed
            const speakingIndex = window.currentChunkIndex;

            u.onstart = () => {
                console.log('[SPEAK DEBUG] Started chunk', speakingIndex + 1);
                chrome.runtime.sendMessage({
                    type: 'speechProgress',
                    current: speakingIndex + 1,
                    total: window.speechChunks.length
                }).catch(() => { });
            };

            u.onend = () => {
                console.log('[SPEAK DEBUG] Ended chunk', speakingIndex + 1);
                // Only increment if we're still on the same chunk (not skipped)
                if (window.currentChunkIndex === speakingIndex) {
                    window.currentChunkIndex++;
                    speakNext();
                } else {
                    console.log('[SPEAK DEBUG] Index changed during playback, not auto-incrementing');
                }
            };

            u.onerror = (e) => {
                console.log('[SPEAK DEBUG] Error on chunk', speakingIndex + 1, e);
                // Only increment if we're still on the same chunk (not skipped)
                if (window.currentChunkIndex === speakingIndex) {
                    window.currentChunkIndex++;
                    speakNext();
                } else {
                    console.log('[SPEAK DEBUG] Index changed during error, not auto-incrementing');
                }
            };

            synth.speak(u);
        }

        speakNext();
    }

    function startContentSpeechRecognition(sendResponse) {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            window.contentRecognition = new SpeechRecognition();
            window.contentRecognition.continuous = false;
            window.contentRecognition.interimResults = false;
            window.contentRecognition.lang = 'en-US';

            window.contentRecognition.onstart = () => {
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionStatus',
                    status: 'listening'
                });
            };

            window.contentRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionResult',
                    transcript: transcript
                });
                sendResponse({ success: true, transcript: transcript });
            };

            window.contentRecognition.onerror = (event) => {
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionError',
                    error: event.error
                });
                sendResponse({ success: false, error: event.error });
            };

            window.contentRecognition.onend = () => {
                chrome.runtime.sendMessage({
                    type: 'speechRecognitionStatus',
                    status: 'ended'
                });
            };

            try {
                window.contentRecognition.start();
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        } else {
            sendResponse({ success: false, error: 'Speech recognition not supported' });
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

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    function clickElementByName(elementName) {
        console.log('[CLICK DEBUG] Starting click search for:', elementName);
        const allElements = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
        console.log('[CLICK DEBUG] Found', allElements.length, 'total clickable elements');
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
        console.log('[CLICK DEBUG] Normalized search term:', searchTermNormalized, 'Words:', searchWords);

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

            if (score > 0) {
                console.log('[CLICK DEBUG] Match found:', {
                    text: displayText.substring(0, 50),
                    score,
                    matchType,
                    isPDFLink,
                    isExternalLink,
                    isInternalAnchor,
                    isTableOfContents,
                    isNavigationLink,
                    isInMainContent,
                    href: href.substring(0, 50),
                    elementType: el.tagName.toLowerCase()
                });
            }
        });

        console.log('[CLICK DEBUG] Total matches:', matches.length);

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

        console.log('[CLICK DEBUG] Top 5 matches after sorting:');
        matches.slice(0, 5).forEach((m, i) => {
            console.log(`  ${i + 1}. "${m.text.substring(0, 40)}" - Score: ${m.score}, PDF: ${m.isPDFLink}, Type: ${m.matchType}, Href: ${m.href?.substring(0, 40) || 'N/A'}`);
        });

        const externalLinkMatches = matches.filter(m => m.isExternalLink && !m.isPDFLink && !m.isTableOfContents && !m.isNavigationLink);
        const contentMatches = matches.filter(m => !m.isPDFLink && !m.isTableOfContents && !m.isNavigationLink && !m.isScrollToAnchor);
        const nonPDFMatches = matches.filter(m => !m.isPDFLink);
        const PDFMatches = matches.filter(m => m.isPDFLink);
        const internalAnchorMatches = matches.filter(m => m.isInternalAnchor);
        const tocMatches = matches.filter(m => m.isTableOfContents || m.isNavigationLink);

        console.log('[CLICK DEBUG] External link matches:', externalLinkMatches.length, 'Content matches:', contentMatches.length, 'Non-PDF matches:', nonPDFMatches.length, 'PDF matches:', PDFMatches.length, 'TOC/Nav matches:', tocMatches.length);

        let finalMatch = null;

        if (searchTermNormalized.includes('external')) {
            if (externalLinkMatches.length > 0) {
                const bestExternal = externalLinkMatches[0];
                console.log('[CLICK DEBUG] User asked for external links, choosing best external link:', bestExternal.text.substring(0, 40), 'Score:', bestExternal.score);
                finalMatch = bestExternal;
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
                    console.log('[CLICK DEBUG] No text match for external links, clicking first visible external link:', text.substring(0, 40));
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
            const bestContent = contentMatches[0];
            console.log('[CLICK DEBUG] Choosing best content match (avoiding TOC/nav):', bestContent.text.substring(0, 40), 'Score:', bestContent.score);
            finalMatch = bestContent;
        }

        if (!finalMatch && nonPDFMatches.length > 0) {
            const bestNonPDF = nonPDFMatches[0];
            console.log('[CLICK DEBUG] Best non-PDF:', bestNonPDF.text.substring(0, 40), 'Score:', bestNonPDF.score, 'IsExternal:', bestNonPDF.isExternalLink, 'IsInternal:', bestNonPDF.isInternalAnchor);
            if (PDFMatches.length > 0) {
                const bestPDF = PDFMatches[0];
                console.log('[CLICK DEBUG] Best PDF:', bestPDF.text.substring(0, 40), 'Score:', bestPDF.score);
                if (bestNonPDF.score >= bestPDF.score - 200) {
                    console.log('[CLICK DEBUG] Choosing non-PDF (within 200 points)');
                    finalMatch = bestNonPDF;
                } else if (bestNonPDF.score >= 200) {
                    console.log('[CLICK DEBUG] Choosing non-PDF (score >= 200)');
                    finalMatch = bestNonPDF;
                } else {
                    console.log('[CLICK DEBUG] Choosing non-PDF (default)');
                    finalMatch = bestNonPDF;
                }
            } else {
                console.log('[CLICK DEBUG] No PDF matches, choosing best non-PDF');
                finalMatch = bestNonPDF;
            }
        } else if (matches.length > 0) {
            console.log('[CLICK DEBUG] No non-PDF matches, using best match (may be PDF)');
            finalMatch = matches[0];
        }

        if (!finalMatch) {
            if (matches.length > 0) {
                const bestAvailable = matches[0];
                console.log('[CLICK DEBUG] No ideal match, using best available (score may be low):', bestAvailable.text.substring(0, 40), 'Score:', bestAvailable.score);
                if (bestAvailable.score >= -200) {
                    finalMatch = bestAvailable;
                }
            }
        }

        if (!finalMatch) {
            console.error('[CLICK DEBUG] No valid match found!');
            throw new Error(`Could not find a good match for: ${elementName}. Found: ${matches.slice(0, 5).map(m => `${m.text.substring(0, 30)} (${m.score}, PDF:${m.isPDFLink})`).join(', ')}`);
        }

        if (finalMatch.score < 50 && !finalMatch.isExternalLink) {
            console.log('[CLICK DEBUG] Warning: Match has low score but proceeding:', finalMatch.score);
        }

        console.log('[CLICK DEBUG] Final selection:', {
            text: finalMatch.text.substring(0, 50),
            score: finalMatch.score,
            isPDFLink: finalMatch.isPDFLink,
            href: finalMatch.href?.substring(0, 50) || 'N/A',
            matchType: finalMatch.matchType
        });

        finalMatch.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            console.log('[CLICK DEBUG] Clicking element:', finalMatch.text.substring(0, 50));
            finalMatch.element.click();
        }, 100);

        return { message: `Clicked "${finalMatch.text || elementName}"` };
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

        return {
            message: `Reading page content (${content.length} characters)`,
            content
        };
    }

    function speakInPage(text) {
        if (typeof text !== 'string' || !text.trim()) return;
        const synth = window.speechSynthesis;
        if (!synth) {
            chrome.runtime.sendMessage({
                type: 'readPageError',
                error: 'speechSynthesis not available'
            }).catch(() => { });
            return;
        }

        synth.cancel();
        window.isReadingPage = true;
        window.currentChunkIndex = 0;
        chrome.runtime.sendMessage({ type: 'readPageStarted' }).catch(() => { });

        function startSpeaking() {
            const trimmed = text.trim();
            // Split into chunks of ~800 characters
            window.speechChunks = trimmed.match(/.{1,800}(\s|$)/g) || [];

            if (window.speechChunks.length === 0 || !window.isReadingPage) {
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

            const intro = speakUtterance('Reading page aloud.');
            const startChunks = () => {
                if (!window.isReadingPage) {
                    window.speechChunks = [];
                    chrome.runtime.sendMessage({ type: 'readPageEnded' }).catch(() => { });
                    return;
                }
                speakFromCurrentChunk();
            };
            intro.onend = startChunks;
            intro.onerror = startChunks;
            synth.speak(intro);
        }

        if (synth.getVoices().length > 0) {
            startSpeaking();
        } else {
            let voicesLoaded = false;
            const once = () => {
                if (!voicesLoaded && synth.getVoices().length > 0) {
                    voicesLoaded = true;
                    synth.onvoiceschanged = null;
                    startSpeaking();
                }
            };
            synth.onvoiceschanged = once;
            setTimeout(() => {
                if (!voicesLoaded) {
                    voicesLoaded = true;
                    startSpeaking();
                }
            }, 300);
        }
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

}