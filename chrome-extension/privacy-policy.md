# Poddle Lens — Privacy Policy

**Effective date:** June 2, 2026
**Extension name:** Poddle Lens
**Published by:** Poddle, Inc.
**Contact:** privacy@poddleme.com

---

## 1. Overview

Poddle Lens is a Chrome Extension that connects to the Poddle decision intelligence platform at poddleme.com. This policy explains what data the extension accesses, how it is used, and what is never collected.

---

## 2. Data the Extension Accesses

### 2a. Active Tab Information
When the Poddle Lens side panel is open, the extension reads the **title and URL** of your current browser tab. This information is displayed only within the side panel UI so you can confirm which page is being analyzed.

### 2b. Page Content (User-Triggered Only)
When you explicitly click the **"Analyze This Page"** button, the extension reads visible text content from the active tab's DOM. This includes:
- Any text you have selected on the page (selected text takes priority).
- The text content of the main article or content area of the page.
- A fallback extract of the page body text (capped at 8,000 characters).

**This extraction happens only when you click the button. The extension never reads page content passively or in the background.**

### 2c. Poddle Account Session
If you are signed in to poddleme.com, your existing session is used within the embedded Poddle interface inside the side panel. Poddle Lens does not create, duplicate, or store your login credentials. Session management is handled entirely by the Poddle web application (poddleme.com) using standard browser localStorage.

---

## 3. Data We Do Not Collect

- We do **not** collect your browsing history.
- We do **not** transmit any data to any server other than poddleme.com.
- We do **not** store page content in extension storage or any third-party service.
- We do **not** use analytics, advertising SDKs, or tracking pixels within the extension itself.
- We do **not** access passwords, form data, or personal information from pages you visit.

---

## 4. How Extracted Content Is Used

When you click "Analyze This Page," the extracted text is passed directly to the poddleme.com application loaded in the side panel via a secure `postMessage` channel. The content is pre-filled into a chat input for your review — **it is not sent automatically**. You decide whether and how to submit it.

Once inside the Poddle application, your use of that content is governed by the [Poddle Privacy Policy](https://poddleme.com/#privacy) and [Terms of Service](https://poddleme.com/#terms).

---

## 5. Permissions Justification

| Permission | Why It Is Required |
|---|---|
| `sidePanel` | To open and render the persistent side panel UI |
| `activeTab` | To read the current tab's title and URL for the context strip |
| `scripting` | To inject the content extraction script into the active tab when you click "Analyze This Page" |
| `storage` | Reserved for future user preferences (e.g., remembering panel settings); no personal data is stored |
| `host_permissions: https://poddleme.com/*` | To enable secure communication between the extension and the Poddle web application |

---

## 6. Data Security

All communication between the extension and poddleme.com uses HTTPS. The `postMessage` API calls within the extension always specify `https://poddleme.com` as the target origin — wildcards are never used — preventing any other origin from receiving extracted content.

---

## 7. Third Parties

Poddle Lens does not share data with any third party. The only external service the extension communicates with is poddleme.com.

---

## 8. Children's Privacy

Poddle Lens is not directed at children under 13. We do not knowingly collect information from children.

---

## 9. Changes to This Policy

We may update this policy. Material changes will be reflected in an updated extension version and noted in the Chrome Web Store listing changelog.

---

## 10. Contact

For any privacy questions related to Poddle Lens, contact us at privacy@poddleme.com or visit [poddleme.com/#contact-us](https://poddleme.com/#contact-us).
