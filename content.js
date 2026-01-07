// content.js - runs in the context of web pages
// Handles hover highlighting, element extraction, and in-page sidebar UI.

let isExtracting = false;
let hoverOverlay = null;
let sidebarEl = null;
let lastExtractedComponent = null; // { html, css }

// Shift page content to make room for the sidebar
function applyPageShiftForSidebar() {
  document.documentElement.style.transition = "margin-right 0.2s ease-out";
  document.body.style.transition = "margin-right 0.2s ease-out";
  document.body.style.marginRight = "360px";
}

// Reset page layout when sidebar is closed
function resetPageShiftForSidebar() {
  document.documentElement.style.marginRight = "";
  document.body.style.marginRight = "";
}

// Create a highlight overlay div if it does not exist
function ensureHoverOverlay() {
  if (hoverOverlay) return;
  hoverOverlay = document.createElement("div");
  hoverOverlay.id = "cre-hover-overlay";
  hoverOverlay.style.position = "absolute";
  hoverOverlay.style.pointerEvents = "none";
  hoverOverlay.style.zIndex = "2147483646";
  hoverOverlay.style.border = "2px solid #1e90ff";
  hoverOverlay.style.borderRadius = "4px";
  hoverOverlay.style.transition = "all 0.05s ease-out";
  hoverOverlay.style.display = "none";
  document.documentElement.appendChild(hoverOverlay);
}

// Cleanup overlay
function removeHoverOverlay() {
  if (hoverOverlay && hoverOverlay.parentNode) {
    hoverOverlay.parentNode.removeChild(hoverOverlay);
  }
  hoverOverlay = null;
}

/**
 * Mouse move handler for hover highlighting during extraction mode.
 * Updates the blue border overlay to follow the cursor over elements.
 * @param {MouseEvent} event - Mouse move event
 */
function handleMouseMove(event) {
  if (!isExtracting || !hoverOverlay) return;
  const target = event.target;
  if (!target || sidebarEl?.contains(target) || target === hoverOverlay) return;

  try {
    const rect = target.getBoundingClientRect();
    hoverOverlay.style.left = `${rect.left + window.scrollX}px`;
    hoverOverlay.style.top = `${rect.top + window.scrollY}px`;
    hoverOverlay.style.width = `${rect.width}px`;
    hoverOverlay.style.height = `${rect.height}px`;
    hoverOverlay.style.display = "block";
  } catch (error) {
    // Silently fail on hover errors to avoid disrupting user experience
    console.warn("CRE: Hover highlight error:", error);
  }
}

// Click handler to perform extraction
function handleClick(event) {
  if (!isExtracting) return;
  const target = event.target;
  if (!target || sidebarEl?.contains(target) || target === hoverOverlay) return;

  event.preventDefault();
  event.stopPropagation();

  try {
    stopExtraction();
    const extracted = extractElement(target);
    lastExtractedComponent = extracted;
    showSidebar(extracted);
  } catch (error) {
    console.error("CRE: Extraction failed:", error);
    stopExtraction();
    alert("Failed to extract component. Please try again.");
  }
}

/**
 * Extract outerHTML and computed CSS for a DOM element.
 * Cleans up IDs/classes to avoid conflicts and extracts relevant styles.
 * @param {HTMLElement} el - The element to extract
 * @returns {{html: string, css: string}} Object with cleaned HTML and extracted CSS
 */
function extractElement(el) {
  if (!el || !el.cloneNode) {
    throw new Error("Invalid element provided for extraction");
  }

  // Deep clone the element to avoid modifying the original
  const cloned = el.cloneNode(true);

  // Clean up IDs and classes to reduce conflicts with target pages
  cleanElementAttributes(cloned);

  const html = cloned.outerHTML;
  const css = buildComputedCssForElement(el);

  return { html, css };
}

/**
 * Recursively clean element attributes to avoid conflicts.
 * Removes IDs, normalizes classes to "cre-component", and strips data-* attributes.
 * @param {Node} node - DOM node to clean (recursively processes children)
 */
function cleanElementAttributes(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  // Remove IDs to prevent conflicts
  node.removeAttribute("id");

  // Normalize all classes to a generic "cre-component" class
  const classList = Array.from(node.classList || []);
  if (classList.length > 0) {
    node.className = "cre-component";
  }

  // Remove data-* attributes (often contain page-specific state)
  const attrs = Array.from(node.attributes || []);
  attrs.forEach((attr) => {
    if (attr.name.startsWith("data-")) {
      node.removeAttribute(attr.name);
    }
  });

  // Recursively clean child elements
  Array.from(node.children).forEach(cleanElementAttributes);
}

/**
 * Extract computed CSS styles for an element and its direct children.
 * Captures layout, typography, colors, and spacing properties.
 * @param {HTMLElement} el - The root element to extract styles from
 * @returns {string} CSS string with styles for the component
 */
function buildComputedCssForElement(el) {
  if (!el || !window.getComputedStyle) {
    return "";
  }

  try {
    const computed = window.getComputedStyle(el);
    const importantProps = [
      // Layout
      "display",
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "width",
      "height",
      "minWidth",
      "minHeight",
      "maxWidth",
      "maxHeight",
      "flexDirection",
      "flexWrap",
      "justifyContent",
      "alignItems",
      "gap",
      // Spacing
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      // Visual
      "backgroundColor",
      "color",
      "border",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderRadius",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomLeftRadius",
      "borderBottomRightRadius",
      "boxShadow",
      "opacity",
      // Typography
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "textAlign",
      "textDecoration",
      "letterSpacing",
      // Other
      "overflow",
      "overflowX",
      "overflowY",
      "cursor",
      "zIndex",
    ];

    const lines = [];
    importantProps.forEach((prop) => {
      const cssName = prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
      const value = computed[prop];

      // Skip empty, zero, or transparent values
      if (
        value &&
        value !== "0px" &&
        value !== "0" &&
        value !== "none" &&
        value !== "rgba(0, 0, 0, 0)" &&
        value !== "transparent" &&
        value !== "normal" &&
        value !== "auto"
      ) {
        lines.push(`  ${cssName}: ${value};`);
      }
    });

    if (!lines.length) return "";
    return `.cre-component {\n${lines.join("\n")}\n}`;
  } catch (error) {
    console.error("CRE: Failed to extract CSS:", error);
    return "";
  }
}

// Inject the sidebar for AI remix and manual editing
function showSidebar(component) {
  removeSidebar();

  sidebarEl = document.createElement("div");
  sidebarEl.id = "cre-sidebar";
  sidebarEl.style.position = "fixed";
  sidebarEl.style.top = "0";
  sidebarEl.style.right = "0";
  sidebarEl.style.width = "360px";
  sidebarEl.style.height = "100vh";
  sidebarEl.style.background = "#111827";
  sidebarEl.style.color = "#e5e7eb";
  sidebarEl.style.zIndex = "2147483647";
  sidebarEl.style.boxShadow = "0 0 12px rgba(0,0,0,0.5)";
  sidebarEl.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  sidebarEl.style.display = "flex";
  sidebarEl.style.flexDirection = "column";

  sidebarEl.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid #1f2937;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:600;font-size:14px;">Component Remix Engine</div>
      <button id="cre-close-sidebar" style="background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:16px;">×</button>
    </div>
    <div style="padding:12px 16px;font-size:12px;line-height:1.5;flex:0 0 auto;">
      <div style="margin-bottom:8px;font-weight:500;">Original preview</div>
      <div id="cre-original-preview" style="background:#111827;border:1px solid #1f2937;border-radius:6px;padding:8px;max-height:140px;overflow:auto;"></div>
      <style id="cre-original-style"></style>
    </div>
    <div style="padding:0 16px 12px;font-size:12px;flex:0 0 auto;">
      <label for="cre-prompt" style="display:block;margin-bottom:4px;font-weight:500;">Remix prompt</label>
      <textarea id="cre-prompt" rows="3" style="width:100%;resize:vertical;border-radius:4px;border:1px solid #374151;background:#020617;color:#e5e7eb;padding:6px 8px;font-size:12px;" placeholder="e.g. Add dark mode and rounded corners"></textarea>
      <button id="cre-remix-btn" style="margin-top:8px;width:100%;padding:6px 8px;border-radius:4px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:500;cursor:pointer;">Remix with AI</button>
      <div id="cre-remix-status" style="margin-top:6px;color:#9ca3af;min-height:16px;"></div>
    </div>
    <div style="flex:1 1 auto;overflow:auto;padding:0 16px 12px;font-size:12px;border-top:1px solid #1f2937;">
      <div style="margin:8px 0;font-weight:500;">Remixed variants</div>
      <div id="cre-variants-container" style="display:flex;flex-direction:column;gap:8px;"></div>
      <div style="margin-top:8px;font-size:11px;color:#9ca3af;">
        You can generate framework-specific code and save components from the extension popup.
      </div>
    </div>
  `;

  document.documentElement.appendChild(sidebarEl);
  applyPageShiftForSidebar();

  // Fill original preview
  const preview = sidebarEl.querySelector("#cre-original-preview");
  const styleEl = sidebarEl.querySelector("#cre-original-style");
  if (preview) {
    preview.innerHTML = component.html;
  }
  if (styleEl) {
    styleEl.textContent = component.css || "";
  }

  // Wire close button
  sidebarEl
    .querySelector("#cre-close-sidebar")
    .addEventListener("click", () => {
      removeSidebar();
    });

  // Wire remix button
  const remixBtn = sidebarEl.querySelector("#cre-remix-btn");
  const promptInput = sidebarEl.querySelector("#cre-prompt");
  const statusEl = sidebarEl.querySelector("#cre-remix-status");

  remixBtn.addEventListener("click", () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      statusEl.textContent = "Enter a prompt to remix the component.";
      statusEl.style.color = "#ef4444"; // Red for error
      return;
    }

    // Reset status styling
    statusEl.style.color = "#9ca3af";
    statusEl.textContent = "Contacting AI…";
    remixBtn.disabled = true;

    // Send AI remix request to background service worker
    chrome.runtime.sendMessage(
      {
        type: "AI_REMIX",
        payload: {
          html: component.html,
          css: component.css,
          prompt,
        },
      },
      (response) => {
        remixBtn.disabled = false;

        // Handle Chrome extension messaging errors
        if (chrome.runtime.lastError) {
          console.error("CRE: Message error:", chrome.runtime.lastError);
          statusEl.textContent = "Failed to communicate with extension. Please reload the page.";
          statusEl.style.color = "#ef4444";
          return;
        }

        if (!response || !response.ok) {
          console.error("CRE: AI remix failed:", response?.error);
          statusEl.textContent =
            response?.error ||
            "AI remix failed. You can manually edit the HTML/CSS when generating code.";
          statusEl.style.color = "#ef4444";
          return;
        }

        // Success - display variants
        const variants = response.variants || [];
        if (variants.length === 0) {
          statusEl.textContent = "No variants returned. Try a different prompt.";
          statusEl.style.color = "#f59e0b"; // Orange for warning
          return;
        }

        statusEl.textContent = `Generated ${variants.length} variant${variants.length > 1 ? "s" : ""}.`;
        statusEl.style.color = "#10b981"; // Green for success
        renderVariants(variants);

        // Notify popup about latest extracted/remixed component for library usage
        chrome.runtime.sendMessage(
          {
            type: "CRE_LATEST_COMPONENT",
            payload: {
              original: component,
              variants: variants,
            },
          },
          () => {
            // Ignore errors from popup notification (popup may be closed)
            if (chrome.runtime.lastError) {
              console.warn("CRE: Could not notify popup:", chrome.runtime.lastError);
            }
          }
        );
      }
    );
  });
}

function renderVariants(variants) {
  if (!sidebarEl) return;
  const container = sidebarEl.querySelector("#cre-variants-container");
  container.innerHTML = "";

  if (!variants || !variants.length) {
    const empty = document.createElement("div");
    empty.textContent = "No variants returned by AI.";
    container.appendChild(empty);
    return;
  }

  variants.forEach((variant, idx) => {
    const card = document.createElement("div");
    card.style.border = "1px solid #1f2937";
    card.style.borderRadius = "6px";
    card.style.padding = "6px 8px";
    card.style.background = "#020617";

    const label = document.createElement("div");
    label.textContent = `Variant ${idx + 1}`;
    label.style.fontWeight = "500";
    label.style.marginBottom = "4px";
    card.appendChild(label);

    if (variant.description) {
      const desc = document.createElement("div");
      desc.textContent = variant.description;
      desc.style.fontSize = "11px";
      desc.style.color = "#9ca3af";
      desc.style.marginBottom = "4px";
      card.appendChild(desc);
    }

    const preview = document.createElement("div");
    preview.style.border = "1px solid #111827";
    preview.style.borderRadius = "4px";
    preview.style.padding = "4px";
    preview.style.maxHeight = "120px";
    preview.style.overflow = "auto";
    preview.innerHTML = variant.html || "";

    const styleEl = document.createElement("style");
    styleEl.textContent = variant.css || "";
    preview.appendChild(styleEl);

    card.appendChild(preview);
    container.appendChild(card);
  });
}

function removeSidebar() {
  if (sidebarEl && sidebarEl.parentNode) {
    sidebarEl.parentNode.removeChild(sidebarEl);
  }
  sidebarEl = null;
  resetPageShiftForSidebar();
}

/**
 * Start extraction mode: enable hover highlighting and click extraction.
 * Adds event listeners for mousemove (highlighting) and click (extraction).
 */
function startExtraction() {
  if (isExtracting) return;
  try {
    isExtracting = true;
    ensureHoverOverlay();
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
  } catch (error) {
    console.error("CRE: Failed to start extraction:", error);
    isExtracting = false;
  }
}

/**
 * Stop extraction mode: remove listeners and hide overlay.
 * Cleans up event listeners and removes the hover highlight overlay.
 */
function stopExtraction() {
  if (!isExtracting) return;
  try {
    isExtracting = false;
    removeHoverOverlay();
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
  } catch (error) {
    console.error("CRE: Error stopping extraction:", error);
    isExtracting = false;
  }
}

// Listen for messages from the popup to start/stop extraction
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "START_EXTRACTION") {
    startExtraction();
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === "STOP_EXTRACTION") {
    stopExtraction();
    sendResponse({ ok: true });
    return;
  }
});
