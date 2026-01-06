// background.js - MV3 service worker for Component Remix Engine (CRE)
// Handles AI remix calls, message routing, and (maybe) centralized storage.

import { callOpenAIForRemix } from "./utils/ai.js";

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async handlers with sendResponse by returning true
  (async () => {
    try {
      if (message?.type === "AI_REMIX") {
        const { html, css, prompt } = message.payload || {};
        const variants = await callOpenAIForRemix({ html, css, prompt });
        sendResponse({ ok: true, variants });
        return;
      }

      // Unknown message type
      sendResponse({ ok: false, error: "Unknown message type in background." });
    } catch (err) {
      console.error("Background error:", err);
      sendResponse({
        ok: false,
        error: err?.message || "Unexpected error in background service worker.",
      });
    }
  })();

  // Indicate that we will respond asynchronously
  return true;
});
