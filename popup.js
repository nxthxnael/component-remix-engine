// popup.js - UI logic for Component Remix Engine (CRE)
// Handles settings, extraction toggle, library search & CRUD, and export.

import {
  getAllComponents,
  saveComponent,
  deleteComponent,
  updateComponent,
  searchComponents,
} from "./utils/storage.js";
import { generateCodeForFramework } from "./utils/codegen.js";
import { showToast } from "./utils/toast.js";

let latestComponentPayload = null; // { original, variants }
let allComponents = [];
let currentSearch = "";
let defaultFramework = "react";
let isLoading = false;

// Listen for messages to keep latest extracted component in sync
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CRE_LATEST_COMPONENT") {
    latestComponentPayload = message.payload;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  wireSettings();
  wireExtractionToggle();
  wireSearch();
  wireSaveLatest();
  await loadComponentsAndRender();
});

/**
 * Wire up settings section - API key and framework selection.
 * Loads saved settings on init and handles saving new settings.
 */
async function wireSettings() {
  const apiKeyInput = document.getElementById("cre-api-key");
  const saveBtn = document.getElementById("cre-save-settings");
  const frameworkSelect = document.getElementById("cre-framework-select");

  // Load stored settings
  chrome.storage.sync.get(["creSettings"], (result) => {
    const settings = result?.creSettings || {};
    if (settings.openaiApiKey) {
      apiKeyInput.value = settings.openaiApiKey;
    } else {
      apiKeyInput.value = "sk-dummykey1234567890";
      apiKeyInput.placeholder =
        "Enter your OpenAI API key or use dummy key for testing";
    }
    if (settings.defaultFramework) {
      frameworkSelect.value = settings.defaultFramework;
      defaultFramework = settings.defaultFramework;
    }
  });

  saveBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const framework = frameworkSelect.value;

    if (!key) {
      showToast("API key cannot be empty. Using dummy key.");
      apiKeyInput.value = "sk-dummykey1234567890";
      return;
    }

    chrome.storage.sync.set(
      {
        creSettings: {
          openaiApiKey: key,
          defaultFramework: framework,
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "CRE: Failed to save settings:",
            chrome.runtime.lastError
          );
          showToast("Failed to save settings. Please try again.");
          return;
        }
        defaultFramework = framework;
        showToast("Settings saved successfully.");
      }
    );
  });

  frameworkSelect.addEventListener("change", () => {
    defaultFramework = frameworkSelect.value;
  });

  // Save settings on Enter key in API key input
  apiKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });
}

/**
 * Wire up the extraction toggle button.
 * Sends messages to content script to start/stop extraction mode.
 */
function wireExtractionToggle() {
  const btn = document.getElementById("cre-toggle-extraction");

  btn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        showToast("No active tab found. Please reload and try again.");
        return;
      }

      // Check if tab is a valid web page (not chrome:// pages)
      if (
        tab.url &&
        (tab.url.startsWith("chrome://") ||
          tab.url.startsWith("chrome-extension://"))
      ) {
        showToast(
          "Extraction is not available on this page. Try a regular website."
        );
        return;
      }

      const starting = btn.dataset.state !== "on";

      chrome.tabs.sendMessage(
        tab.id,
        { type: starting ? "START_EXTRACTION" : "STOP_EXTRACTION" },
        (response) => {
          // Handle Chrome extension errors
          if (chrome.runtime.lastError) {
            console.error("CRE: Message error:", chrome.runtime.lastError);
            showToast(
              "Failed to communicate with page. Try reloading the page."
            );
            return;
          }

          if (response && response.ok) {
            const on = starting;
            btn.dataset.state = on ? "on" : "off";
            btn.textContent = on ? "Stop extraction" : "Start extraction";
            btn.classList.toggle("cre-btn-primary", !on);
            btn.classList.toggle("cre-btn-secondary", on);
          } else {
            showToast("Failed to toggle extraction mode.");
          }
        }
      );
    });
  });
}

/**
 * Wire up search functionality with debouncing.
 * Uses the searchComponents helper from storage.js for consistent search behavior.
 */
function wireSearch() {
  const searchInput = document.getElementById("cre-search");
  let searchTimeout = null;

  searchInput.addEventListener("input", async () => {
    currentSearch = searchInput.value.trim();

    // Debounce search to avoid excessive re-renders
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      // Use searchComponents helper for consistency
      if (currentSearch) {
        const filtered = await searchComponents(currentSearch);
        renderLibraryWithComponents(filtered);
      } else {
        renderLibrary();
      }
    }, 150);
  });
}

/**
 * Wire up the "Save latest component" button.
 * Saves the most recently extracted/remixed component to the library.
 */
function wireSaveLatest() {
  const btn = document.getElementById("cre-save-latest");
  btn.addEventListener("click", async () => {
    if (!latestComponentPayload || !latestComponentPayload.original) {
      showToast(
        "No extracted component available yet. Extract an element first."
      );
      return;
    }

    if (isLoading) {
      showToast("Please wait, operation in progress...");
      return;
    }

    try {
      const name = prompt("Name for this component?", "My Component");
      if (!name || !name.trim()) {
        if (name !== null) {
          showToast("Component name cannot be empty.");
        }
        return;
      }

      const tagsInput = prompt("Tags (comma separated)?", "extracted, remix");
      const tags = (tagsInput || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      isLoading = true;
      btn.disabled = true;

      const base = latestComponentPayload.original;
      const variants = latestComponentPayload.variants || [];

      // Pick first variant when available, else original
      const preferredVariant = variants[0] || {
        html: base.html,
        css: base.css,
      };
      const framework = defaultFramework;

      let code;
      try {
        code = generateCodeForFramework(
          framework,
          preferredVariant,
          name.trim()
        );
      } catch (error) {
        console.error("CRE: Code generation failed:", error);
        showToast(`Failed to generate code: ${error.message}`);
        isLoading = false;
        btn.disabled = false;
        return;
      }

      const saved = await saveComponent({
        name: name.trim(),
        tags,
        originalHTML: base.html,
        originalCSS: base.css,
        remixedVariants: variants,
        generatedCode: code,
        framework,
      });

      allComponents.push(saved);
      renderLibrary();
      showToast(`Component "${saved.name}" saved to library.`);

      // Clear latest payload after saving (optional - comment out if you want to keep it)
      // latestComponentPayload = null;
    } catch (error) {
      console.error("CRE: Failed to save component:", error);
      showToast("Failed to save component. Please try again.");
    } finally {
      isLoading = false;
      btn.disabled = false;
    }
  });
}

/**
 * Load all components from storage and render the library.
 * Called on popup initialization and after component operations.
 */
async function loadComponentsAndRender() {
  try {
    isLoading = true;
    allComponents = await getAllComponents();
    renderLibrary();
  } catch (error) {
    console.error("CRE: Failed to load components:", error);
    showToast("Failed to load component library.");
    allComponents = [];
  } finally {
    isLoading = false;
  }
}

/**
 * Render the component library grid.
 * Filters components based on currentSearch if provided.
 */
function renderLibrary() {
  const filtered = allComponents.filter((c) => {
    if (!currentSearch) return true;
    const haystack = `${c.name} ${(c.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(currentSearch.toLowerCase());
  });

  renderLibraryWithComponents(filtered);
}

/**
 * Render library grid with a specific array of components.
 * @param {Array} components - Array of component objects to render
 */
function renderLibraryWithComponents(components) {
  const grid = document.getElementById("cre-library-grid");
  const empty = document.getElementById("cre-library-empty");

  grid.innerHTML = "";

  if (!components || !components.length) {
    empty.style.display = "block";
    empty.textContent = currentSearch
      ? `No components found matching "${currentSearch}"`
      : "No components saved yet. Extract an element, remix it, then save it here.";
    return;
  }

  empty.style.display = "none";

  components.forEach((comp) => {
    const card = document.createElement("div");
    card.className = "cre-card";

    const header = document.createElement("div");
    header.className = "cre-card-header";
    const nameEl = document.createElement("div");
    nameEl.className = "cre-card-name";
    nameEl.textContent = comp.name;
    const frameworkEl = document.createElement("div");
    frameworkEl.className = "cre-card-meta";
    frameworkEl.textContent = comp.framework.toUpperCase();
    header.appendChild(nameEl);
    header.appendChild(frameworkEl);

    const tagsRow = document.createElement("div");
    tagsRow.className = "cre-card-tags";
    (comp.tags || []).forEach((tag) => {
      const pill = document.createElement("span");
      pill.className = "cre-tag-pill";
      pill.textContent = tag;
      tagsRow.appendChild(pill);
    });

    const meta = document.createElement("div");
    meta.className = "cre-card-meta";
    const createdDate = comp.createdAt ? new Date(comp.createdAt) : null;
    if (createdDate) {
      meta.textContent = `Saved ${createdDate.toLocaleString()}`;
    }

    const preview = document.createElement("div");
    preview.className = "cre-card-preview";
    preview.innerHTML = comp.originalHTML || "";

    const styleEl = document.createElement("style");
    styleEl.textContent = comp.originalCSS || "";
    preview.appendChild(styleEl);

    const actions = document.createElement("div");
    actions.className = "cre-card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "cre-btn cre-btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => handleEditComponent(comp));

    const exportBtn = document.createElement("button");
    exportBtn.className = "cre-btn cre-btn-secondary";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", () => handleExportComponent(comp));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "cre-btn cre-btn-secondary";
    deleteBtn.textContent = "Delete";
    deleteBtn.style.color = "#dc2626"; // Red for delete action
    deleteBtn.addEventListener("click", async () => {
      if (
        !confirm(`Delete "${comp.name}" from library? This cannot be undone.`)
      ) {
        return;
      }

      try {
        await deleteComponent(comp.id);
        allComponents = allComponents.filter((c) => c.id !== comp.id);
        renderLibrary();
        showToast(`"${comp.name}" deleted.`);
      } catch (error) {
        console.error("CRE: Failed to delete component:", error);
        showToast("Failed to delete component. Please try again.");
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(header);
    if (tagsRow.childNodes.length) {
      card.appendChild(tagsRow);
    }
    card.appendChild(meta);
    card.appendChild(preview);
    card.appendChild(actions);
    grid.appendChild(card);
  });
}

/**
 * Handle component editing - update name and tags.
 * @param {Object} comp - Component object to edit
 */
function handleEditComponent(comp) {
  const newName = prompt("Rename component:", comp.name || "");
  if (!newName || !newName.trim()) {
    if (newName !== null) {
      showToast("Component name cannot be empty.");
    }
    return;
  }

  const newTagsRaw = prompt(
    "Edit tags (comma separated):",
    (comp.tags || []).join(", ")
  );

  const newTags = (newTagsRaw || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const updated = { ...comp, name: newName.trim(), tags: newTags };

  updateComponent(updated.id, updated)
    .then(() => {
      const idx = allComponents.findIndex((c) => c.id === comp.id);
      if (idx >= 0) {
        allComponents[idx] = { ...allComponents[idx], ...updated };
      }
      renderLibrary();
      showToast("Component updated.");
    })
    .catch((error) => {
      console.error("CRE: Failed to update component:", error);
      showToast("Failed to update component. Please try again.");
    });
}

/**
 * Handle component export with variant selection and export method.
 * Supports copying to clipboard or downloading as file.
 * @param {Object} comp - Component object to export
 */
function handleExportComponent(comp) {
  const framework = comp.framework || "react";

  // Determine which variant to export
  let variantToExport = { html: comp.originalHTML, css: comp.originalCSS };

  // If there are remixed variants, let user choose
  if (comp.remixedVariants && comp.remixedVariants.length > 0) {
    const variantChoices = [
      "Original",
      ...comp.remixedVariants.map(
        (v, idx) => `Variant ${idx + 1}: ${v.description || "Untitled"}`
      ),
    ].join("\n");

    const choice = prompt(
      `Choose variant to export:\n${variantChoices}\n\nEnter 0 for original, 1-${comp.remixedVariants.length} for variants:`,
      "0"
    );

    if (choice === null) return; // User cancelled

    const idx = parseInt(choice, 10);
    if (idx >= 1 && idx <= comp.remixedVariants.length) {
      variantToExport = comp.remixedVariants[idx - 1];
    }
    // If idx === 0 or invalid, use original (already set)
  }

  // Generate code for selected variant
  let code;
  try {
    code =
      comp.generatedCode ||
      generateCodeForFramework(framework, variantToExport, comp.name);

    // If we're using a variant, regenerate code for that variant
    if (
      comp.remixedVariants &&
      comp.remixedVariants.length > 0 &&
      !(
        variantToExport.html === comp.originalHTML &&
        variantToExport.css === comp.originalCSS
      )
    ) {
      code = generateCodeForFramework(framework, variantToExport, comp.name);
    }
  } catch (error) {
    console.error("CRE: Code generation failed:", error);
    showToast(`Export failed: ${error.message}`);
    return;
  }

  // Show export options dialog
  const action = prompt(
    `Export "${
      comp.name
    }" as ${framework.toUpperCase()}?\n\nEnter "c" to copy to clipboard\nEnter "d" to download file\n(Press Cancel to abort)`,
    "c"
  );

  if (!action) return;

  const actionLower = action.toLowerCase().trim();

  if (actionLower === "c" || actionLower === "copy") {
    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          showToast(
            "Code copied to clipboard. Respect copyrights when reusing extracted components."
          );
        })
        .catch((err) => {
          console.error("CRE: Clipboard copy failed:", err);
          showToast("Clipboard copy failed. Try downloading instead.");
        });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = code;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Code copied. Respect copyrights when reusing.");
      } catch (err) {
        showToast("Clipboard copy failed. Try downloading instead.");
      }
      document.body.removeChild(textArea);
    }
  } else if (actionLower === "d" || actionLower === "download") {
    // Download file
    try {
      const { filename, blob } = buildDownloadBlob(framework, code, comp);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}. Respect copyrights when reusing.`);
    } catch (error) {
      console.error("CRE: Download failed:", error);
      showToast("Download failed. Please try again.");
    }
  } else {
    showToast('Invalid option. Use "c" for copy or "d" for download.');
  }
}

function buildDownloadBlob(framework, code, comp) {
  let filename = comp.name.replace(/\s+/g, "") || "Component";
  let ext = ".jsx";
  if (framework === "vue") {
    ext = ".vue";
  } else if (framework === "html") {
    ext = ".html";
  }
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  return { filename: `${filename}${ext}`, blob };
}
