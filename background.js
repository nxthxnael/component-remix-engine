// background.js - MV3 service worker for Component Remix Engine (CRE)
// Handles AI remix calls, message routing between content scripts and popup.

import { callOpenAIForRemix } from "./utils/ai.js";

// In-memory cache for the API key
let cachedApiKey = null;

/**
 * Get the API key from storage or use the default dummy key.
 * This ensures the API key is only handled in the background script.
 */
async function getApiKey() {
  if (cachedApiKey) return cachedApiKey;

  return new Promise((resolve) => {
    chrome.storage.local.get(["creSettings"], (result) => {
      const settings = result?.creSettings || {};
      // Use the stored key or fall back to dummy key
      cachedApiKey = settings.openaiApiKey || "sk-dummykey1234567890";
      resolve(cachedApiKey);
    });
  });
}

/**
 * Set the API key in storage.
 * This should be called from the extension's options page or settings UI.
 */
async function setApiKey(apiKey) {
  cachedApiKey = apiKey;
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ creSettings: { openaiApiKey: apiKey } }, () => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(`Failed to save API key: ${chrome.runtime.lastError}`)
        );
      } else {
        resolve();
      }
    });
  });
}

/**
 * Message listener for extension communication.
 * Handles AI_REMIX requests from content scripts and routes responses back.
 * Also handles API key management from the extension's settings.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async handlers with sendResponse by returning true
  (async () => {
    try {
      // Handle AI remix requests
      if (message?.type === "AI_REMIX") {
        const { html, css, prompt } = message.payload || {};

        // Validate payload
        if (!html && !css) {
          sendResponse({
            ok: false,
            error: "Cannot remix: component HTML and CSS are both empty.",
          });
          return;
        }

        if (!prompt || !prompt.trim()) {
          sendResponse({
            ok: false,
            error: "Please provide a remix prompt (e.g., 'add dark mode').",
          });
          return;
        }

        // Get API key (will use dummy key if not set)
        const apiKey = await getApiKey();

        // Call OpenAI API with the key
        const variants = await callOpenAIForRemix(
          {
            html: html || "",
            css: css || "",
            prompt: prompt.trim(),
          },
          apiKey
        );

        sendResponse({ ok: true, variants });
        return;
      }

      // Handle API key management
      else if (message?.type === "GET_API_KEY") {
        const key = await getApiKey();
        sendResponse({ ok: true, key });
        return;
      } else if (message?.type === "SET_API_KEY") {
        const { key } = message.payload || {};
        if (!key || typeof key !== "string") {
          sendResponse({
            ok: false,
            error: "Invalid API key format.",
          });
          return;
        }

        try {
          await setApiKey(key.trim());
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({
            ok: false,
            error: `Failed to save API key: ${err.message}`,
          });
        }
        return;
      }

      // Unknown message type
      sendResponse({
        ok: false,
        error: `Unknown message type: ${message?.type || "undefined"}`,
      });
    } catch (err) {
      console.error("CRE: Background service worker error:", err);

      // Provide user-friendly error messages
      let errorMessage =
        err?.message || "Unexpected error in background service worker.";

      // Handle specific error cases
      if (errorMessage.includes("API key") || errorMessage.includes("401")) {
        errorMessage = "Invalid OpenAI API key. Please check your settings.";
      } else if (
        errorMessage.includes("Network") ||
        errorMessage.includes("fetch")
      ) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("429")
      ) {
        errorMessage =
          "OpenAI API rate limit exceeded. Please try again later.";
      }

      sendResponse({
        ok: false,
        error: errorMessage,
      });
    }
  })();

  // Indicate that we will respond asynchronously
  return true;
});
