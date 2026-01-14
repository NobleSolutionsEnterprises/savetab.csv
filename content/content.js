console.log("Content script loaded");

/**
 * Scrolls the page down by 'pages' viewport heights.
 * @param {number} pages - Number of viewports to scroll.
 * @returns {Promise<void>}
 */
async function scrollPage(pages = 2) {
    const viewportHeight = window.innerHeight;
    const targetScroll = Math.min(
        document.body.scrollHeight - viewportHeight,
        window.scrollY + (viewportHeight * pages)
    );

    const startY = window.scrollY;
    const distance = targetScroll - startY;
    const steps = 20; // steps per page
    const totalSteps = steps * pages;
    const stepSize = distance / totalSteps;

    for (let i = 0; i < totalSteps; i++) {
        window.scrollBy(0, stepSize);
        await new Promise(r => setTimeout(r, 50)); // Wait for lazy load
    }

    window.scrollTo(0, targetScroll);
    await new Promise(r => setTimeout(r, 500));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrollAndCapture") {
        const pages = request.pageCount || 2; // Default to 2 if not provided
        scrollPage(pages).then(() => {
            sendResponse({ status: "scrolled", title: document.title, url: window.location.href });
        });
        return true;
    }
    if (request.action === "scrollToTop") {
        window.scrollTo(0, 0);
        setTimeout(() => sendResponse({ status: "scrolledTop" }), 200);
        return true;
    }
    if (request.action === "scrollByViewport") {
        window.scrollBy(0, window.innerHeight);
        setTimeout(() => sendResponse({ status: "scrolled" }), 500); // Wait for render
        return true;
    }
    if (request.action === "getDimensions") {
        sendResponse({
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            fullHeight: document.body.scrollHeight
        });
    }
});
