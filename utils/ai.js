// utils/ai.js
// Thin wrapper around the OpenAI Chat Completions API for remixing components.
// Handles API key retrieval from chrome.storage.sync and makes requests to OpenAI.

const DEFAULT_DUMMY_KEY = "sk-dummykey1234567890";

/**
 * Retrieve OpenAI API key from chrome.storage.sync or return dummy key.
 * Falls back to dummy key if storage is unavailable or no key is set.
 * @returns {Promise<string>} API key string
 */
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
 * @param {Object} params - Parameters for remix request
 * @param {string} params.html - Original HTML of the component
 * @param {string} params.css - Original CSS of the component
 * @param {string} params.prompt - User's natural language remix prompt
 * @param {string} apiKey - OpenAI API key to use for the request
 * @returns {Promise<Array<{html: string, css: string, description: string}>>} Array of remixed variants
 * @throws {Error} If API request fails or response is invalid
 */
export async function callOpenAIForRemix({ html, css, prompt }, apiKey) {
  if (!html && !css) {
    throw new Error("Cannot remix: both HTML and CSS are empty");
  }

  // Enhanced system prompt for better AI responses
  const systemPrompt = `You are a front-end development assistant that remixes UI components based on user prompts.

Your task:
1. Take the original HTML and CSS provided
2. Apply the user's remix request (e.g., "add dark mode", "make it rounded", "change colors")
3. Generate 3 distinct variants that implement the request in different ways
4. Return ONLY valid JSON with this exact structure:
{
  "variants": [
    {
      "html": "<modified HTML string>",
      "css": "<modified CSS string>",
      "description": "Brief description of what changed (e.g., 'Dark mode with blue accents')"
    },
    ...
  ]
}

Rules:
- Preserve the component's structure and functionality
- Only modify what the user requested
- Ensure HTML and CSS are valid and properly formatted
- Each variant should be meaningfully different
- Keep descriptions concise (1 sentence max)`;

  const userPrompt = [
    "=== ORIGINAL COMPONENT ===",
    "",
    "HTML:",
    html || "(empty)",
    "",
    "CSS:",
    css || "(empty)",
    "",
    "=== REMIX REQUEST ===",
    prompt || "No specific request - create 3 creative variations",
    "",
    "Generate 3 remixed variants as JSON:",
  ].join("\n");

  const body = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000, // Limit response size
  };

  try {
    // Make API request to OpenAI
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
      let errorMsg = `OpenAI API error (${resp.status})`;

      // Try to extract meaningful error message
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error?.message || errorMsg;
      } catch {
        // If parsing fails, use the raw text (truncated)
        errorMsg = text.length > 100 ? text.substring(0, 100) + "..." : text;
      }

      throw new Error(errorMsg);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(
        "OpenAI response missing content. The API may have returned an empty response."
      );
    }

    // Parse JSON response, handling code fences if present
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      // Try to extract JSON from markdown code fences
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object in the response
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          parsed = JSON.parse(jsonObjectMatch[0]);
        } else {
          throw new Error(
            `Failed to parse AI response as JSON: ${err.message}`
          );
        }
      }
    }

    // Validate response structure
    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI response is not a valid JSON object");
    }

    if (!parsed.variants || !Array.isArray(parsed.variants)) {
      throw new Error("AI response missing 'variants' array");
    }

    if (parsed.variants.length === 0) {
      throw new Error("AI returned zero variants");
    }

    // Normalize and validate variants
    const normalized = parsed.variants
      .slice(0, 3) // Limit to 3 variants max
      .map((v, idx) => ({
        html: String(v.html || "").trim(),
        css: String(v.css || "").trim(),
        description: String(v.description || `Variant ${idx + 1}`).trim(),
      }))
      .filter((v) => v.html || v.css); // Remove completely empty variants

    if (normalized.length === 0) {
      throw new Error("All AI variants were empty or invalid");
    }

    return normalized;
  } catch (error) {
    console.error("CRE: AI remix error:", error);

    // Re-throw with more context if it's a network error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Network error: Could not reach OpenAI API. Check your internet connection."
      );
    }

    throw error;
  }
}
