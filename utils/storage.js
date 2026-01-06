// utils/storage.js
// Helpers around chrome.storage.sync for persisting component library entries.

/**
 * Component schema:
 * {
 *   id: string (unique identifier, e.g., "cre-abc123-xyz9")
 *   name: string (display name)
 *   tags: string[] (array of tag strings for search/filtering)
 *   originalHTML: string (extracted HTML from webpage)
 *   originalCSS: string (extracted/computed CSS)
 *   remixedVariants: Array<{html: string, css: string, description: string}> (AI-generated variants)
 *   generatedCode: string (framework-specific code output)
 *   framework: "react" | "vue" | "html" (target framework)
 *   createdAt: number (timestamp)
 *   updatedAt: number (timestamp)
 * }
 */

const STORAGE_KEY = "creComponents";

function withSyncStorage(getter) {
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve(getter({}));
      return;
    }
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      resolve(getter(result || {}));
    });
  });
}

function setSyncStorage(data) {
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve();
      return;
    }
    chrome.storage.sync.set({ [STORAGE_KEY]: data }, () => resolve());
  });
}

function createId() {
  return (
    "cre-" +
    Math.random().toString(36).slice(2, 8) +
    "-" +
    Date.now().toString(36).slice(-4)
  );
}

/**
 * Retrieve all saved components from chrome.storage.sync.
 * @returns {Promise<Array>} Array of component objects
 */
export async function getAllComponents() {
  return withSyncStorage((raw) => raw[STORAGE_KEY] || []);
}

/**
 * Save a new component to the library.
 * @param {Object} partial - Partial component data (name, tags, originalHTML, etc.)
 * @returns {Promise<Object>} The saved component with generated id and timestamps
 */
export async function saveComponent(partial) {
  const current = await getAllComponents();
  const now = Date.now();
  const entry = {
    id: createId(),
    name: partial.name || "Untitled component",
    tags: partial.tags || [],
    originalHTML: partial.originalHTML || "",
    originalCSS: partial.originalCSS || "",
    remixedVariants: partial.remixedVariants || [],
    generatedCode: partial.generatedCode || "",
    framework: partial.framework || "react",
    createdAt: now,
    updatedAt: now,
  };
  const next = [...current, entry];
  await setSyncStorage(next);
  return entry;
}

/**
 * Update an existing component by id.
 * @param {string} id - Component id
 * @param {Object} patch - Fields to update (merged into existing component)
 */
export async function updateComponent(id, patch) {
  const current = await getAllComponents();
  const next = current.map((c) =>
    c.id === id
      ? {
          ...c,
          ...patch,
          updatedAt: Date.now(),
        }
      : c
  );
  await setSyncStorage(next);
}

/**
 * Delete a component from the library by id.
 * @param {string} id - Component id to delete
 */
export async function deleteComponent(id) {
  const current = await getAllComponents();
  const next = current.filter((c) => c.id !== id);
  await setSyncStorage(next);
}

/**
 * Search components by name and tags (case-insensitive).
 * @param {string} query - Search query string
 * @returns {Promise<Array>} Filtered array of matching components
 */
export async function searchComponents(query) {
  const all = await getAllComponents();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter((c) => {
    const haystack = `${c.name} ${(c.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(q);
  });
}
