const MISTRAL_API_KEY = 'YOUR_MISTRAL_API_KEY_HERE'; // Replace with your actual API key

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
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        loadingProgress.style.width = '30%';

        const htmlFiles = [];
        zip.forEach((relativePath, file) => {
            if (relativePath.endsWith('.html') || relativePath.endsWith('.xhtml')) {
                htmlFiles.push(file);
            }
        });

        loadingProgress.style.width = '50%';

        let allContent = '';
        for (const file of htmlFiles) {
            const text = await file.async('text');
            allContent += text;
        }

        loadingProgress.style.width = '70%';

        const parser = new DOMParser();
        const doc = parser.parseFromString(allContent, 'text/html');
        const bodyContent = doc.body.innerHTML;

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
    const result = document.createElement('div');

    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const words = node.textContent.split(/\s+/).filter(w => w.trim());
            wordCount += words.length;
            sectionText += node.textContent;

            if (wordCount >= WORD_THRESHOLD) {
                const trigger = document.createElement('div');
                trigger.className = 'section-trigger';
                trigger.textContent = '✦ ✦ ✦ ✦ ✦';
                trigger.dataset.summaryText = sectionText;
                result.appendChild(trigger);
                wordCount = 0;
                sectionText = '';
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const clone = node.cloneNode(false);
            result.appendChild(clone);
            Array.from(node.childNodes).forEach(child => processNode(child));
        }
    }

    Array.from(tempDiv.childNodes).forEach(child => processNode(child));

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
