// background.js - MV3 service worker for Component Remix Engine (CRE)
// Handles AI remix calls, message routing between content scripts and popup.

import { callOpenAIForRemix } from "./utils/ai.js";

/**
 * Message listener for extension communication.
 * Handles AI_REMIX requests from content scripts and routes responses back.
 * 
 * Message flow:
 * 1. Content script sends AI_REMIX message with {html, css, prompt}
 * 2. Background calls OpenAI API via callOpenAIForRemix
 * 3. Background sends response back to content script with variants
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async handlers with sendResponse by returning true
  (async () => {
    try {
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

        // Call OpenAI API
        const variants = await callOpenAIForRemix({
          html: html || "",
          css: css || "",
          prompt: prompt.trim(),
        });

        sendResponse({ ok: true, variants });
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
      let errorMessage = err?.message || "Unexpected error in background service worker.";
      
      // Handle specific error cases
      if (errorMessage.includes("API key") || errorMessage.includes("401")) {
        errorMessage = "Invalid OpenAI API key. Please check your settings.";
      } else if (errorMessage.includes("Network") || errorMessage.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        errorMessage = "OpenAI API rate limit exceeded. Please try again later.";
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
