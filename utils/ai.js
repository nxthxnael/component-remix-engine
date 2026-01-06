// utils/ai.js
// Thin wrapper around the OpenAI Chat Completions API for remixing components.

const DEFAULT_DUMMY_KEY = "sk-dummykey1234567890";

async function getApiKey() {
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve(DEFAULT_DUMMY_KEY);
      return;
    }
    chrome.storage.sync.get(["creSettings"], (result) => {
      const stored = result?.creSettings;
      if (stored && stored.openaiApiKey && stored.openaiApiKey.trim()) {
        resolve(stored.openaiApiKey.trim());
      } else {
        resolve(DEFAULT_DUMMY_KEY);
      }
    });
  });
}

/**
 * Call OpenAI to generate three remixed variants of a component.
 * The model is instructed to return a strict JSON payload for easier parsing.
 */
export async function callOpenAIForRemix({ html, css, prompt }) {
  const apiKey = await getApiKey();
  const body = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          'You are a front-end helper that rewrites small UI components. Always respond with strict JSON: { "variants": [ { "html": string, "css": string, "description": string }, ... ] } and nothing else.',
      },
      {
        role: "user",
        content: [
          "Original HTML:",
          html || "",
          "",
          "Original CSS:",
          css || "",
          "",
          "User remix prompt:",
          prompt || "",
        ].join("\n"),
      },
    ],
    temperature: 0.7,
  };

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI request failed (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response missing content.");
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      // Try to salvage JSON if wrapped in code fences
      const match = content.match(/```json([\s\S]*?)```/i);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        throw err;
      }
    }

    if (!parsed?.variants || !Array.isArray(parsed.variants)) {
      throw new Error("OpenAI response did not contain a variants array.");
    }

    // Normalize variants to have { html, css, description }
    return parsed.variants.map((v) => ({
      html: v.html || "",
      css: v.css || "",
      description: v.description || "",
    }));
  } catch (error) {
    console.error("callOpenAIForRemix error:", error);
    throw error;
  }
}
