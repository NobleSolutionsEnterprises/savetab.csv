import { getRecords, updateRecords, exportCSV, getImageURL, deleteImage } from '../lib/file-manager.js';

console.log("Options page loaded");

const loadBtn = document.getElementById('loadBtn');
const tableBody = document.querySelector('#tabsTable tbody');
const statusMsg = document.getElementById('statusMsg');
const categoryFilter = document.getElementById('categoryFilter');
const searchFilter = document.getElementById('searchFilter');
const selectAll = document.getElementById('selectAll');
const deleteBtn = document.getElementById('deleteBtn');

let allRecords = [];
let currentSort = { col: 'date', dir: 'desc' };
let selectedIndices = new Set();

// Theme Logic
const themeToggle = document.getElementById('themeToggle');
const storedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', storedTheme);
updateThemeIcon(storedTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentChanged = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentChanged);
        localStorage.setItem('theme', currentChanged);
        updateThemeIcon(currentChanged);
    });
}

function updateThemeIcon(theme) {
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}


async function loadData() {
    try {
        loadBtn.textContent = "Loading...";
        showStatus('Loading records...');
        tableBody.innerHTML = '';

        allRecords = await getRecords();
        // Assign unique IDs for UI selection
        allRecords.forEach((r, i) => r._id = `rec-${i}-${Date.now()}`);

        // Populate Categories (normalize)
        const uniqueCats = new Map();
        allRecords.forEach(r => {
            if (!r.category) return;
            const key = r.category.trim().toLowerCase();
            if (!uniqueCats.has(key)) {
                uniqueCats.set(key, r.category.trim());
            } else {
                // Prefer capitalized version
                const existing = uniqueCats.get(key);
                if (r.category[0] === r.category[0].toUpperCase() && existing[0] !== existing[0].toUpperCase()) {
                    uniqueCats.set(key, r.category.trim());
                }
            }
        });

        const sortedCats = Array.from(uniqueCats.values()).sort();
        updateCategoryDropdown(sortedCats);

        // Sync to storage so Popup sees only valid categories
        chrome.storage.local.set({ categories: sortedCats });

        //  Rebuild recentTags
        const sortedByDate = [...allRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        const rebuiltTags = new Set();
        sortedByDate.forEach(r => {
            if (r.tags) {
                r.tags.split(',').forEach(t => {
                    const tag = t.trim();
                    if (tag) rebuiltTags.add(tag);
                });
            }
        });
        const recentTags = Array.from(rebuiltTags).slice(0, 50);
        chrome.storage.local.set({ recentTags: recentTags });

        updateTagCloud(allRecords);
        renderTable(allRecords);
        loadBtn.textContent = "Reload Data";

    } catch (e) {
        console.error(e);
        showStatus(`Error: ${e.message}`);
        loadBtn.textContent = "Reload Data";
    }
}

function showStatus(msg) {
    if (msg) {
        statusMsg.textContent = msg;
        statusMsg.style.display = 'block';
        tableBody.innerHTML = '';
    } else {
        statusMsg.style.display = 'none';
    }
}

function updateCategoryDropdown(categories) {
    const currentVal = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    // Restore selection
    if (currentVal) {
        for (let i = 0; i < categoryFilter.options.length; i++) {
            if (categoryFilter.options[i].value === currentVal) {
                categoryFilter.selectedIndex = i;
                break;
            }
        }
    }
}

function filterRecords() {
    const cat = categoryFilter.value.toLowerCase();
    const search = searchFilter.value.toLowerCase().replace(/#/g, '');

    return allRecords.filter(record => {
        const rCat = record.category ? record.category.trim().toLowerCase() : '';
        const matchCat = !cat || rCat === cat;

        const matchSearch = !search ||
            (record.title && record.title.toLowerCase().includes(search)) ||
            (record.tags && record.tags.toLowerCase().includes(search)) ||
            (record.url && record.url.toLowerCase().includes(search));

        return matchCat && matchSearch;
    });
}

function sortRecords(records) {
    const { col, dir } = currentSort;
    return [...records].sort((a, b) => {
        let va = a[col] || '';
        let vb = b[col] || '';

        if (col === 'date') {
            va = new Date(va);
            vb = new Date(vb);
        } else {
            va = va.toString().toLowerCase();
            vb = vb.toString().toLowerCase();
        }

        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

async function renderTable(records) {
    // 1. Filter
    const filtered = filterRecords();
    // 2. Sort
    const sorted = sortRecords(filtered);

    tableBody.innerHTML = '';

    if (sorted.length === 0) {
        showStatus('No matching records found.');
        return;
    }
    showStatus('');

    const fragment = document.createDocumentFragment();

    for (const record of sorted) {
        const tr = document.createElement('tr');

        // Checkbox + Edit
        const tdCheck = document.createElement('td');
        tdCheck.style.textAlign = 'left';
        tdCheck.style.paddingLeft = '5px';
        tdCheck.style.whiteSpace = 'nowrap';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedIndices.has(record._id);
        checkbox.style.marginRight = '8px';
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) selectedIndices.add(record._id);
            else selectedIndices.delete(record._id);
            updateDeleteBtn();
        });
        tdCheck.appendChild(checkbox);

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-icon';
        editBtn.textContent = '✏️';
        editBtn.title = "Edit Tab";
        editBtn.style.background = 'none';
        editBtn.style.border = 'none';
        editBtn.style.cursor = 'pointer';
        editBtn.style.fontSize = '1.1em';
        editBtn.style.padding = '0';
        editBtn.style.verticalAlign = 'middle';

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(record);
        });
        tdCheck.appendChild(editBtn);

        tr.appendChild(tdCheck);

        // Image column
        const tdImg = document.createElement('td');
        if (record.imagePath) {
            const img = document.createElement('img');
            img.className = 'thumb-img';
            img.src = record.imagePath;
            img.title = `Click to open full image (${record.imageFilename})`;
            img.style.cursor = 'pointer';
            img.onerror = () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNjAiPjxyZWN0IGZpbGw9IiNmZmNjY2MiIHdpZHRoPSIxMDAiIGhlaWdodD0iNjAiLz48dGV4dCB4PSI1MCIgeT0iMzUiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkVuYWJsZSBmaWxlOi8vPC90ZXh0Pjwvc3ZnPg==';
                img.title = 'Enable "Allow access to file URLs" in chrome://extensions';
            };

            const a = document.createElement('a');
            a.href = record.imagePath;
            a.target = "_blank";
            a.appendChild(img);
            tdImg.appendChild(a);
        }
        tr.appendChild(tdImg);

        // Date
        const tdDate = document.createElement('td');
        const dateObj = new Date(record.date);
        const relative = getRelativeTime(dateObj);
        const absolute = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        tdDate.innerHTML = `<div style="line-height: 1.4;"><strong>${relative}</strong><br><span style="font-weight: normal; font-size: 0.9em;">${absolute}</span></div>`;
        tr.appendChild(tdDate);

        // Category
        const tdCat = document.createElement('td');
        tdCat.innerHTML = `<strong>${record.category}</strong>`;
        tr.appendChild(tdCat);

        // Title & URL
        const tdTitle = document.createElement('td');
        const titleLink = document.createElement('a');
        titleLink.href = record.url;
        titleLink.className = 'title-link';
        titleLink.textContent = record.title;
        titleLink.target = "_blank";
        tdTitle.appendChild(titleLink);

        const urlDiv = document.createElement('div');
        const urlA = document.createElement('a');
        urlA.className = 'url-text';
        urlA.href = record.url;
        urlA.target = "_blank";
        urlA.textContent = record.url;
        urlA.title = record.url;
        urlDiv.appendChild(urlA);
        tdTitle.appendChild(urlDiv);

        tr.appendChild(tdTitle);

        // Tags
        const tdTags = document.createElement('td');
        if (record.tags) {
            record.tags.split(',').forEach(tag => {
                const t = tag.trim();
                if (t) {
                    const span = document.createElement('span');
                    span.className = 'tag';
                    const tagText = t.startsWith('#') ? t : '#' + t;
                    span.textContent = tagText;

                    span.addEventListener('click', () => {
                        searchFilter.value = tagText;
                        onFilterChange();
                    });

                    tdTags.appendChild(span);
                }
            });
        }
        tr.appendChild(tdTags);

        // Action
        const tdAction = document.createElement('td');
        tdAction.className = 'col-actions';

        const openBtn = document.createElement('a');
        openBtn.className = 'btn-icon';
        openBtn.href = record.url;
        openBtn.target = "_blank";
        openBtn.textContent = 'Open';
        openBtn.style.textDecoration = 'none';
        openBtn.style.alignSelf = 'center';
        tdAction.appendChild(openBtn);

        tr.appendChild(tdAction);

        fragment.appendChild(tr);
    }

    tableBody.appendChild(fragment);

    // Update selectAll
    const allFilteredIds = sorted.map(r => r._id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIndices.has(id));
    if (selectAll) selectAll.checked = allSelected;
    
    // Update delete button state
    updateDeleteBtn();
}

function updateDeleteBtn() {
    if (!deleteBtn) return;
    if (selectedIndices.size > 0) {
        deleteBtn.removeAttribute('disabled');
        deleteBtn.textContent = `Delete Selected (${selectedIndices.size})`;
    } else {
        deleteBtn.setAttribute('disabled', 'true');
        deleteBtn.textContent = `Delete Selected`;
    }
}

// Listeners
function onFilterChange() {
    renderTable(allRecords);
}

// Sorting listeners
document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (currentSort.col === col) {
            currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.col = col;
            currentSort.dir = 'asc';
        }

        document.querySelectorAll('th.sortable').forEach(t => t.classList.remove('asc', 'desc'));
        th.classList.add(currentSort.dir);

        onFilterChange();
    });
});

if (selectAll) {
    selectAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const filtered = filterRecords();
        filtered.forEach(r => {
            if (checked) selectedIndices.add(r._id);
            else selectedIndices.delete(r._id);
        });
        renderTable(allRecords);
        updateDeleteBtn();
    });
}

// Modal Elements
const deleteModal = document.getElementById('deleteModal');
const deleteModalText = document.getElementById('deleteModalText');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');

if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
        if (selectedIndices.size === 0) return;
        deleteModalText.textContent = `Are you sure you want to delete ${selectedIndices.size} items?`;
        deleteModal.style.display = 'flex';
    });
}

if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });
}

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        deleteModal.style.display = 'none';
        await executeDelete();
    });
}

async function executeDelete() {
    try {
        console.log("[DELETE] Starting deletion process...");
        console.log("[DELETE] Selected indices:", Array.from(selectedIndices));
        console.log("[DELETE] Total records before delete:", allRecords.length);

        const toDelete = allRecords.filter(r => selectedIndices.has(r._id));
        const toKeep = allRecords.filter(r => !selectedIndices.has(r._id));

        console.log(`[DELETE] Deleting ${toDelete.length} items`);
        console.log(`[DELETE] Keeping ${toKeep.length} items`);

        // Delete images from IndexedDB
        for (const r of toDelete) {
            if (r.imageFilename) {
                await deleteImage(r.imageFilename);
            }
        }
        await updateRecords(toKeep);

        selectedIndices.clear();
        await loadData();

        alert("Deleted successfully. (Images remain in Downloads/SavedTabs folder)");

    } catch (e) {
        console.error(e);
        alert("Error deleting: " + e.message);
    }
}

// --- Edit Modal Logic ---
const editModal = document.getElementById('editModal');
const editTitleInput = document.getElementById('editTitle');
const editCategoryInput = document.getElementById('editCategory');
const editTagsInput = document.getElementById('editTags');
const saveEditBtn = document.getElementById('saveEdit');
const cancelEditBtn = document.getElementById('cancelEdit');
let currentEditingRecallId = null;

function openEditModal(record) {
    currentEditingRecallId = record._id;
    editTitleInput.value = record.title || '';
    editCategoryInput.value = record.category || '';
    editTagsInput.value = record.tags || '';
    editModal.style.display = 'flex';
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
        currentEditingRecallId = null;
    });
}

if (saveEditBtn) {
    saveEditBtn.addEventListener('click', async () => {
        if (!currentEditingRecallId) return;

        const newTitle = editTitleInput.value.trim();
        const newCategory = editCategoryInput.value.trim();
        const newTags = editTagsInput.value.trim();

        if (!newTitle) {
            alert("Title is required.");
            return;
        }

        const record = allRecords.find(r => r._id === currentEditingRecallId);
        if (record) {
            record.title = newTitle;
            record.category = newCategory;
            record.tags = newTags;

            try {
                await updateRecords(allRecords);

                editModal.style.display = 'none';
                currentEditingRecallId = null;

                await loadData();
            } catch (e) {
                console.error("Save Edit Error:", e);
                alert("Failed to save changes: " + e.message);
            }
        }
    });
}


categoryFilter.addEventListener('change', onFilterChange);
searchFilter.addEventListener('input', onFilterChange);
loadBtn.addEventListener('click', loadData);

loadData();

const downloadCsvBtn = document.getElementById('downloadCsvBtn');

if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', async () => {
        if (!allRecords || allRecords.length === 0) {
            alert("No records to download. Please load data first.");
            return;
        }

        try {
            await exportCSV();
            alert("CSV export started! Check your Downloads folder.");
        } catch (e) {
            console.error("Export Error:", e);
            alert("Error exporting CSV: " + e.message);
        }
    });
}

function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    return `${years} year${years === 1 ? '' : 's'} ago`;
}

function updateTagCloud(records) {
    const tagCounts = {};
    records.forEach(r => {
        if (r.tags) {
            r.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            });
        }
    });

    const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10

    const cloudContainer = document.getElementById('tagCloud');
    if (!cloudContainer) return;

    cloudContainer.innerHTML = '';

    sortedTags.forEach(([tag, count]) => {
        const span = document.createElement('span');
        span.className = 'header-tag';
        span.textContent = `${tag} (${count})`;

        span.addEventListener('click', () => {
            const tagText = tag.startsWith('#') ? tag : '#' + tag;
            searchFilter.value = tagText;
            onFilterChange();
        });

        cloudContainer.appendChild(span);
    });
}
