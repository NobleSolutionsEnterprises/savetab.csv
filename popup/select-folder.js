const btn = document.getElementById('selectBtn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
    try {
        console.log('[SELECT-FOLDER] Button clicked');
        status.textContent = 'Opening folder picker...';
        const handle = await window.showDirectoryPicker();
        console.log('[SELECT-FOLDER] Got handle:', handle);
        status.textContent = 'Saving to storage...';

        // Storage logic
        const DB_NAME = 'TabSaverDB';
        const STORE_NAME = 'handles';

        console.log('[SELECT-FOLDER] Opening IndexedDB...');
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (event) => {
                console.log('[SELECT-FOLDER] Upgrading DB...');
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                    console.log('[SELECT-FOLDER] Created object store');
                }
            };
            request.onsuccess = (event) => {
                console.log('[SELECT-FOLDER] DB opened successfully');
                resolve(event.target.result);
            };
            request.onerror = (event) => {
                console.error('[SELECT-FOLDER] DB open error:', event.target.error);
                reject(event.target.error);
            };
        });

        console.log('[SELECT-FOLDER] Storing handle...');
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(handle, 'rootDirectory');
            request.onsuccess = () => {
                console.log('[SELECT-FOLDER] Handle stored successfully!');
                resolve();
            };
            request.onerror = (err) => {
                console.error('[SELECT-FOLDER] Store error:', err);
                reject(request.error);
            };
        });

        console.log('[SELECT-FOLDER] SUCCESS! Folder saved.');
        status.textContent = '✅ Folder saved! Closing in 2 seconds...';
        status.style.color = '#4ade80';
        setTimeout(() => {
            console.log('[SELECT-FOLDER] Closing window');
            window.close();
        }, 2000);
    } catch (err) {
        console.error('[SELECT-FOLDER] Error:', err);
        if (err.name === 'AbortError') {
            status.textContent = '❌ Selection cancelled. Click the button to try again.';
        } else {
            status.textContent = '❌ Error: ' + err.message;
        }
        status.style.color = '#f87171';
    }
});

// Auto-click on load
console.log('[SELECT-FOLDER] Page loaded, auto-clicking in 500ms');
setTimeout(() => {
    console.log('[SELECT-FOLDER] Auto-clicking button');
    btn.click();
}, 500);
