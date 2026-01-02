const MISTRAL_API_KEY = 'UyFZtjZY3r5aNe1th2qtx6IBLynCc0ai'; // Replace with your actual API key

const WORD_THRESHOLD = 1000;
let isBookLoaded = false;
let currentBookName = '';
let lastScrollY = 0;
const header = document.getElementById('header');
const content = document.getElementById('content');
const popup = document.getElementById('popup');
const popupContent = document.getElementById('popupContent');
const closePopup = document.getElementById('closePopup');
const epubInput = document.getElementById('epubInput');
const loadingBar = document.getElementById('loadingBar');
const loadingProgress = document.getElementById('loadingProgress');

// Lazy Text Wrapping with IntersectionObserver
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.wrapped) {
            wrapWordsInElement(entry.target);
            entry.target.dataset.wrapped = 'true';
        }
    });
}, {
    rootMargin: '400px'
});

function wrapWordsInElement(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(textNode => {
        const words = textNode.textContent.split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        words.forEach(word => {
            if (word.match(/\S/)) {
                const span = document.createElement('span');
                span.textContent = word;
                span.className = 'word';
                span.addEventListener('click', handleWordClick);
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(word));
            }
        });
        textNode.parentNode.replaceChild(fragment, textNode);
    });
}

// EPUB Processing
async function processEPUB(file) {
    currentBookName = file.name;
    loadingBar.style.display = 'block';
    loadingProgress.style.width = '0%';

    try {
        // Use FileReader for better browser compatibility
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        const zip = await JSZip.loadAsync(arrayBuffer);

        loadingProgress.style.width = '20%';

        // Extract all resources
        const htmlFiles = [];
        const cssFiles = {};
        const imageFiles = {};

        zip.forEach((relativePath, zipFile) => {
            if (relativePath.endsWith('.html') || relativePath.endsWith('.xhtml')) {
                htmlFiles.push(zipFile);
            } else if (relativePath.endsWith('.css')) {
                cssFiles[relativePath] = zipFile;
            } else if (relativePath.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                imageFiles[relativePath] = zipFile;
            }
        });

        loadingProgress.style.width = '40%';

        // Load CSS files
        const cssDataMap = {};
        for (const [path, zipFile] of Object.entries(cssFiles)) {
            const cssText = await zipFile.async('text');
            const fileName = path.split('/').pop();
            cssDataMap[fileName] = cssText;
            cssDataMap[path] = cssText;
        }

        loadingProgress.style.width = '50%';

        // Load image files as data URLs
        const imageDataMap = {};
        for (const [path, zipFile] of Object.entries(imageFiles)) {
            const blob = await zipFile.async('blob');
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            const fileName = path.split('/').pop();
            imageDataMap[fileName] = dataUrl;
            imageDataMap[path] = dataUrl;
            // Also handle paths with "images/" prefix
            imageDataMap['images/' + fileName] = dataUrl;
        }

        loadingProgress.style.width = '60%';

        // Load and combine HTML content
        let allContent = '';
        for (const htmlFile of htmlFiles) {
            const text = await htmlFile.async('text');
            allContent += text;
        }

        loadingProgress.style.width = '70%';

        const parser = new DOMParser();
        const doc = parser.parseFromString(allContent, 'text/html');

        // Replace CSS links with inline styles
        const linkTags = doc.querySelectorAll('link[rel="stylesheet"]');
        linkTags.forEach(link => {
            const href = link.getAttribute('href');
            const fileName = href.split('/').pop();
            if (cssDataMap[fileName] || cssDataMap[href]) {
                const styleTag = doc.createElement('style');
                styleTag.textContent = cssDataMap[fileName] || cssDataMap[href];
                link.parentNode.replaceChild(styleTag, link);
            } else {
                link.remove(); // Remove broken CSS links
            }
        });

        // Replace image sources with data URLs
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                const fileName = src.split('/').pop();
                if (imageDataMap[src] || imageDataMap[fileName]) {
                    img.src = imageDataMap[src] || imageDataMap[fileName];
                }
            }
        });

        const bodyContent = doc.body.innerHTML;

        loadingProgress.style.width = '80%';

        content.innerHTML = '';
        const sections = divideSections(bodyContent);
        content.innerHTML = sections;

        loadingProgress.style.width = '90%';

        // Observe all block elements for lazy wrapping
        const blockElements = content.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li');
        blockElements.forEach(el => observer.observe(el));

        // Setup section summary handlers
        const summaryTriggers = content.querySelectorAll('.section-trigger');
        summaryTriggers.forEach(trigger => {
            trigger.addEventListener('click', handleSectionSummary);
        });

        loadingProgress.style.width = '100%';
        setTimeout(() => {
            loadingBar.style.display = 'none';
        }, 500);

        isBookLoaded = true;
        restoreScrollPosition();

    } catch (error) {
        console.error('Error processing EPUB:', error);
        alert('Failed to load EPUB file. Please try another file.');
        loadingBar.style.display = 'none';
    }
}

// AI Integration
async function callAI(prompt, systemPrompt) {
    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: 'mistral-large-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ]
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('AI call failed:', error);
        return 'Failed to get response from AI. Please try again.';
    }
}

async function getWordDefinition(word) {
    const cleanWord = word.replace(/[^\w]/g, '');
    const prompt = `Define the word "${cleanWord}" in one sentence.`;
    const systemPrompt = 'You are a helpful dictionary assistant. Provide concise, clear definitions.';
    return await callAI(prompt, systemPrompt);
}

async function getSectionSummary(text) {
    if (!text || text.trim().length === 0) {
        return 'No text available to summarize.';
    }
    const truncatedText = text.substring(0, 5000);
    const prompt = `Summarize the following text in 7-8 sentences:\n\n${truncatedText}`;
    const systemPrompt = 'You are a helpful reading assistant. Provide clear, concise summaries.';
    return await callAI(prompt, systemPrompt);
}

// Divide content into sections with summary triggers
function divideSections(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    let wordCount = 0;
    let sectionText = '';
    const resultHTML = [];

    function getTextContent(node) {
        let text = '';
        if (node.nodeType === Node.TEXT_NODE) {
            text = node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            Array.from(node.childNodes).forEach(child => {
                text += getTextContent(child);
            });
        }
        return text;
    }

    function processNode(node, parent) {
        if (node.nodeType === Node.TEXT_NODE) {
            const words = node.textContent.split(/\s+/).filter(w => w.trim());
            wordCount += words.length;
            sectionText += node.textContent;

            parent.appendChild(node.cloneNode(true));

            if (wordCount >= WORD_THRESHOLD) {
                const trigger = document.createElement('div');
                trigger.className = 'section-trigger';
                trigger.textContent = '✦ ✦ ✦ ✦ ✦';
                trigger.dataset.summaryText = sectionText;
                parent.appendChild(trigger);
                wordCount = 0;
                sectionText = '';
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const clone = node.cloneNode(false);
            parent.appendChild(clone);
            Array.from(node.childNodes).forEach(child => processNode(child, clone));
        }
    }

    const result = document.createElement('div');
    Array.from(tempDiv.childNodes).forEach(child => processNode(child, result));

    return result.innerHTML;
}

// Event Handlers
async function handleWordClick(e) {
    const word = e.target.textContent;
    popupContent.innerHTML = '<div class="loading">Loading definition...</div>';
    popup.classList.add('active');

    const definition = await getWordDefinition(word);
    popupContent.innerHTML = `<h3>${word}</h3><p>${definition}</p>`;
}

async function handleSectionSummary(e) {
    const text = e.target.dataset.summaryText;
    popupContent.innerHTML = '<div class="loading">Generating summary...</div>';
    popup.classList.add('active');

    const summary = await getSectionSummary(text);
    popupContent.innerHTML = `<h3>Section Summary</h3><p>${summary}</p>`;
}

closePopup.addEventListener('click', () => {
    popup.classList.remove('active');
});

popup.addEventListener('click', (e) => {
    if (e.target === popup) {
        popup.classList.remove('active');
    }
});

// Scroll Persistence
function saveScrollPosition() {
    if (isBookLoaded && currentBookName) {
        localStorage.setItem(`scroll_${currentBookName}`, window.scrollY);
    }
}

function restoreScrollPosition() {
    if (currentBookName) {
        const savedPosition = localStorage.getItem(`scroll_${currentBookName}`);
        if (savedPosition) {
            window.scrollTo(0, parseInt(savedPosition));
        }
    }
}

// Auto-hide header on scroll
window.addEventListener('scroll', () => {
    if (!isBookLoaded) return;

    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
    lastScrollY = currentScrollY;

    saveScrollPosition();
});

// File input handler
epubInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processEPUB(file);
    }
});
