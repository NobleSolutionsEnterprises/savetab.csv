/**
 * Manages saving tabs using Downloads API with file:// URL support
 * Images are saved to Downloads/SavedTabs/ and accessed via file:// URLs
 */

const STORAGE_KEY = 'savedTabs';
const DOWNLOAD_FOLDER = 'SavedTabs';

/**
 * Save a screenshot and get its file:// URL
 */
export async function saveImage(blob, filename) {
    console.log('[SAVE-IMAGE] Saving:', filename);

    // Convert blob to data URL
    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });

    // Download the file
    const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: dataUrl,
            filename: `${DOWNLOAD_FOLDER}/${filename}`,
            saveAs: false
        }, (id) => {
            if (chrome.runtime.lastError) {
                console.error('[SAVE-IMAGE] Download error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                console.log('[SAVE-IMAGE] Download started, ID:', id);
                resolve(id);
            }
        });
    });

    // Wait for download to complete and get the file path
    const filePath = await new Promise((resolve, reject) => {
        const checkDownload = () => {
            chrome.downloads.search({ id: downloadId }, (results) => {
                if (results && results.length > 0) {
                    const download = results[0];

                    if (download.state === 'complete') {
                        console.log('[SAVE-IMAGE] Download complete, path:', download.filename);
                        resolve(download.filename); // This is the absolute path
                    } else if (download.state === 'interrupted') {
                        reject(new Error('Download interrupted'));
                    } else {
                        // Still downloading, check again
                        setTimeout(checkDownload, 100);
                    }
                } else {
                    reject(new Error('Download not found'));
                }
            });
        };

        checkDownload();
    });

    // Construct file:// URL
    const fileUrl = `file:///${filePath}`;
    console.log('[SAVE-IMAGE] File URL:', fileUrl);

    return { filename, fileUrl };
}

/**
 * Save a tab record to chrome.storage
 */
export async function saveRecord(record) {
    console.log('[STORAGE] Saving record:', record);

    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const records = result[STORAGE_KEY] || [];

    records.push(record);

    await chrome.storage.local.set({ [STORAGE_KEY]: records });
    console.log('[STORAGE] Record saved. Total:', records.length);

    // Also save to CSV file in Downloads/SavedTabs
    await saveCSVToDownloads(records);
}

/**
 * Get all saved tab records
 */
export async function getRecords() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || [];
}

/**
 * Update records
 */
export async function updateRecords(records) {
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
    // Also update CSV file
    await saveCSVToDownloads(records);
}

/**
 * Save CSV file to Downloads/SavedTabs folder
 */
async function saveCSVToDownloads(records) {
    console.log('[CSV] Saving data.csv to Downloads/SavedTabs...');

    let csv = 'Date,Category,Tags,Title,URL,ImageFilename,ImagePath\n';

    const escape = (field) => {
        const stringField = String(field || '');
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    for (const r of records) {
        const line = [
            r.date,
            escape(r.category),
            escape(r.tags),
            escape(r.title),
            escape(r.url),
            escape(r.imageFilename),
            escape(r.imagePath || '')
        ].join(',') + '\n';
        csv += line;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });

    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: dataUrl,
            filename: `${DOWNLOAD_FOLDER}/data.csv`,
            saveAs: false,
            conflictAction: 'overwrite'
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('[CSV] Save error:', chrome.runtime.lastError);
                resolve(); // Don't fail the whole operation
            } else {
                console.log('[CSV] data.csv saved to Downloads/SavedTabs');
                resolve(downloadId);
            }
        });
    });
}

/**
 * Export CSV (user-initiated download with saveAs)
 */
export async function exportCSV() {
    const records = await getRecords();

    let csv = 'Date,Category,Tags,Title,URL,ImageFilename,ImagePath\n';

    const escape = (field) => {
        const stringField = String(field || '');
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    for (const r of records) {
        const line = [
            r.date,
            escape(r.category),
            escape(r.tags),
            escape(r.title),
            escape(r.url),
            escape(r.imageFilename),
            escape(r.imagePath || '')
        ].join(',') + '\n';
        csv += line;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });

    const filename = `saved-tabs-export-${new Date().toISOString().split('T')[0]}.csv`;

    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(downloadId);
            }
        });
    });
}

// Dummy functions for compatibility (no longer needed but kept for safety)
export async function getImageURL(filename) {
    return null; // Not used anymore
}

export async function deleteImage(filename) {
    // Images stay in Downloads folder
    console.log('[DELETE] Note: Image file remains in Downloads/SavedTabs/', filename);
}
