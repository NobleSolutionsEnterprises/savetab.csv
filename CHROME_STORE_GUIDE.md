# Publishing to the Chrome Web Store

This guide outlines the steps to publish **SaveTab.csv** to the Chrome Web Store.

## 1. Prepare Your Package
1.  **Clean Up**: Remove any unnecessary files (like `.git` folder, `README.md`, `LICENSE`, or design files) from the folder you intend to upload, or just ensure you only select the extension files.
    *   *Tip:* It's best to copy the essential folders (`background`, `content`, `icons`, `lib`, `options`, `popup`) and `manifest.json` into a separate `dist` or `build` folder.
2.  **Create a ZIP File**: Compress the extension directory into a `.zip` file.
    *   Windows: Right-click the folder > Send to > Compressed (zipped) folder.
    *   **Important**: The `manifest.json` must be at the *root* of the zip file, not inside a nested folder.

## 2. Developer Account
1.  Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/dev/dashboard).
2.  Sign in with your Google Account.
3.  Register as a developer.
    *   **Note**: There is a one-time registration fee of **$5 USD**.

## 3. Upload and Setup
1.  Click **"New Item"** in the dashboard.
2.  Upload your `.zip` file.
3.  **Store Listing**: Fill in the required details:
    *   **Title**: SaveTab.csv
    *   **Description**: Explanation of features (Save tabs, CSV export, Screenshots, etc.).
    *   **Category**: Productivity or Developer Tools.
    *   **Language**: English.
    *   **Screenshots**: You must upload at least one screenshot (1280x800 or 640x400).
    *   **Icon**: Upload a 128x128 icon (you can use `icons/tab2csv.png`).

## 4. Privacy Practices (Crucial)
Because this extension uses powerful permissions, you must justify them.

*   **Host Permissions (`<all_urls>`)**:
    *   *Justification*: "This extension needs access to all URLs to allow the user to capture full-page screenshots and scrape metadata (title, URL) from any website they visit and wish to save."
*   **Permissions**:
    *   `storage`: "To save user preferences (categories, recent tags) locally."
    *   `activeTab`: "To access the current tab when the popup is opened."
    *   `scripting`: "To inject the scrolling and capturing scripts into the page."
    *   `downloads`: "To export the CSV data and screenshot images to the user's computer."

**Note**: Since you are requesting `<all_urls>`, the review process may take longer (days to weeks) as it triggers a manual review.

## 5. Submit for Review
1.  Once all sections are green (completed), click **"Submit for Review"**.
2.  Wait for the email notification regarding acceptance or required changes.

## 6. Updates
To update the extension later:
1.  Increment the `version` number in `manifest.json` (e.g., `"1.0"` -> `"1.1"`).
2.  Zip the files again.
3.  Go to the dashboard, click your item, choose **"Package"** > **"Upload new package"**.
