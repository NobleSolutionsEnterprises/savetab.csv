
import { saveImage, saveRecord } from '../lib/file-manager.js';

console.log("Popup loaded");

const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');
const categoryInput = document.getElementById('category');
const tagsInput = document.getElementById('tags');

// Load last used category/tags
chrome.storage.local.get(['categories', 'recentTags'], (result) => {
    if (result.categories) {
        const categorySelect = document.getElementById('categorySelect');
        const categoryInput = document.getElementById('category');

        // Deduplicate categories for display (Case-Insensitive)
        const uniqueCats = new Set();
        const displayCats = [];

        (result.categories || []).forEach(cat => {
            const key = cat.trim().toLowerCase();
            if (!uniqueCats.has(key)) {
                uniqueCats.add(key);
                // Prefer "General" over "general"
                if (key === 'general') {
                    displayCats.push('General');
                } else {
                    displayCats.push(cat.trim());
                }
            }
        });

        // Ensure General is there if not
        if (!uniqueCats.has('general')) displayCats.push('General');

        displayCats.sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });

        // Listener for select change
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value) {
                categoryInput.value = categorySelect.value;
            }
        });
    }

    if (result.recentTags && Array.isArray(result.recentTags)) {
        const recentTagsDiv = document.getElementById('recentTags');
        const tags = result.recentTags.slice(-20).reverse();

        if (tags.length > 0) {
            recentTagsDiv.innerHTML = '<span style="width:100%; font-weight:bold; margin-bottom:4px">Recent: </span>';
        }

        tags.forEach(tag => {
            const span = document.createElement('span');
            span.textContent = tag;
            span.style.cursor = 'pointer';
            span.style.backgroundColor = '#e0e0e0';
            span.style.padding = '3px 8px';
            span.style.borderRadius = '12px';
            span.style.fontSize = '11px';
            span.style.border = '1px solid #ccc';
            span.title = "Click to add";

            span.addEventListener('click', () => {
                const current = tagsInput.value.trim();
                if (current) {
                    // Avoid adding duplicate tag to input
                    const parts = current.split(',').map(s => s.trim());
                    if (!parts.includes(tag)) {
                        tagsInput.value = current + ', ' + tag;
                    }
                } else {
                    tagsInput.value = tag;
                }
            });
            recentTagsDiv.appendChild(span);
        });
    }
});

function updateRecentTags(newTagsStr) {
    if (!newTagsStr) return;
    const newTags = newTagsStr.split(',').map(t => t.trim()).filter(t => t);

    chrome.storage.local.get(['recentTags'], (res) => {
        let existing = res.recentTags || [];

        newTags.forEach(nt => {
            // Remove if exists to move to end (MRU)
            existing = existing.filter(t => t !== nt);
            existing.push(nt);
        });

        // Limit to 50
        if (existing.length > 50) existing = existing.slice(-50);

        chrome.storage.local.set({ recentTags: existing });
    });
}

function setStatus(msg) {
    statusDiv.textContent = msg;
}

async function captureTab() {
    try {
        const saveScreenshot = document.getElementById('saveScreenshot').checked;
        const pageCount = parseInt(document.getElementById('pageCount').value) || 2;
        setStatus("Starting process...");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
            setStatus("Error: Cannot capture restricted browser pages. Please try a normal website.");
            return;
        }

        // Normalize Category first
        let finalCategory = categoryInput.value.trim();
        if (finalCategory) {
            const res = await chrome.storage.local.get(['categories']);
            const cats = res.categories || ['General'];
            const existing = cats.find(c => c.toLowerCase() === finalCategory.toLowerCase());
            if (existing) {
                finalCategory = existing;
            } else {
                cats.push(finalCategory);
                chrome.storage.local.set({ categories: cats });
            }
        } else {
            finalCategory = 'General';
        }

        let filename = '';
        let imagePath = '';

        if (saveScreenshot) {
            // screenshot logic
            // Ensure content script
            try {
                await chrome.tabs.sendMessage(tab.id, { action: "ping" });
            } catch (e) {
                setStatus("Injecting script...");
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content/content.js']
                });
                await new Promise(r => setTimeout(r, 100));
            }

            setStatus("Scrolling to top...");
            await chrome.tabs.sendMessage(tab.id, { action: "scrollToTop" });

            // Capture Loop
            const images = [];
            // Capture initial viewport
            setStatus(`Capturing viewport 1...`);
            images.push(await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }));

            // Scroll and capture based on pageCount
            // If pageCount is 1, we just take the first one (already done).
            // If 2, we scroll once and take 2nd.
            for (let i = 1; i < pageCount; i++) {
                setStatus(`Scrolling (${i}/${pageCount})...`);
                await chrome.tabs.sendMessage(tab.id, { action: "scrollByViewport" });

                setStatus(`Capturing viewport ${i + 1}...`);
                images.push(await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }));
            }

            setStatus("Processing image...");

            // Load all images
            const loadedImages = await Promise.all(images.map(url => loadImage(url)));

            // Get dims (not strictly needed for stitching if all images are same size, but good for context)
            // const dims = await chrome.tabs.sendMessage(tab.id, { action: "getDimensions" });

            // Stitch
            const canvas = document.createElement('canvas');
            const captureHeight = loadedImages[0].height;
            const totalHeight = captureHeight * loadedImages.length;

            canvas.width = loadedImages[0].width;
            canvas.height = totalHeight;

            const ctx = canvas.getContext('2d');
            loadedImages.forEach((img, index) => {
                ctx.drawImage(img, 0, captureHeight * index);
            });

            const finalBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.6));

            const title = tab.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `${title}_${dateStr}.jpg`;

            setStatus("Saving image file...");
            const imageResult = await saveImage(finalBlob, filename);
            filename = imageResult.filename;
            imagePath = imageResult.fileUrl;
        }

        // Save Record
        const record = {
            date: new Date().toJSON(),
            category: finalCategory,
            tags: tagsInput.value,
            title: tab.title,
            url: tab.url,
            imageFilename: filename,
            imagePath: imagePath
        };

        setStatus("Saving record...");
        await saveRecord(record);

        updateRecentTags(tagsInput.value);

        setStatus("Saved!");
        setTimeout(() => window.close(), 1500);

    } catch (e) {
        console.error(e);
        setStatus("Error: " + e.message);
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

saveBtn.addEventListener('click', captureTab);

document.getElementById('viewBtn').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options/options.html'));
    }
});
