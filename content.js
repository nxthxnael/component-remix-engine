// content.js - runs in the context of web pages
// Handles hover highlighting, element extraction, and in-page sidebar UI.

let isExtracting = false;
let hoverOverlay = null;
let sidebarEl = null;
let lastExtractedComponent = null; // { html, css }

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

// Mouse move handler for highlighting
function handleMouseMove(event) {
  if (!isExtracting || !hoverOverlay) return;
  const target = event.target;
  if (!target || sidebarEl?.contains(target) || target === hoverOverlay) return;

  const rect = target.getBoundingClientRect();
  hoverOverlay.style.left = `${rect.left + window.scrollX}px`;
  hoverOverlay.style.top = `${rect.top + window.scrollY}px`;
  hoverOverlay.style.width = `${rect.width}px`;
  hoverOverlay.style.height = `${rect.height}px`;
  hoverOverlay.style.display = "block";
}

// Click handler to perform extraction
function handleClick(event) {
  if (!isExtracting) return;
  const target = event.target;
  if (!target || sidebarEl?.contains(target) || target === hoverOverlay) return;

  event.preventDefault();
  event.stopPropagation();

  stopExtraction();
  const extracted = extractElement(target);
  lastExtractedComponent = extracted;
  showSidebar(extracted);
}

// Extract outerHTML and a basic computed CSS block for the element
function extractElement(el) {
  const cloned = el.cloneNode(true);

  // Clean up IDs and classes to reduce conflicts
  cleanElementAttributes(cloned);

  const html = cloned.outerHTML;
  const css = buildBasicCssForElement(el);

  return { html, css };
}

// Strip data-* attributes and normalize IDs/classes
function cleanElementAttributes(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  node.removeAttribute("id");

  const classList = Array.from(node.classList || []);
  if (classList.length > 0) {
    node.className = "cre-component";
  }

  // Remove data-* attributes
  const attrs = Array.from(node.attributes || []);
  attrs.forEach((attr) => {
    if (attr.name.startsWith("data-")) {
      node.removeAttribute(attr.name);
    }
  });

  Array.from(node.children).forEach(cleanElementAttributes);
}

// Build a very simple CSS rule using computed styles for the root element only
function buildBasicCssForElement(el) {
  const computed = window.getComputedStyle(el);
  const importantProps = [
    "display",
    "position",
    "margin",
    "padding",
    "backgroundColor",
    "color",
    "fontSize",
    "fontWeight",
    "border",
    "borderRadius",
  ];

  const lines = [];
  importantProps.forEach((prop) => {
    const cssName = prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
    const value = computed[prop];
    if (
      value &&
      value !== "0px" &&
      value !== "none" &&
      value !== "rgba(0, 0, 0, 0)"
    ) {
      lines.push(`  ${cssName}: ${value};`);
    }
  });

  if (!lines.length) return "";
  return `.cre-component {\n${lines.join("\n")}\n}`;
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
      return;
    }
    statusEl.textContent = "Contacting AI…";
    remixBtn.disabled = true;

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
        if (!response || !response.ok) {
          console.error("AI remix failed:", response?.error);
          statusEl.textContent =
            "AI remix failed. You can manually edit the HTML/CSS when generating code.";
          return;
        }
        statusEl.textContent = "Got remixed variants.";
        renderVariants(response.variants || []);

        // Notify popup about latest extracted/remixed component for library usage
        chrome.runtime.sendMessage({
          type: "CRE_LATEST_COMPONENT",
          payload: {
            original: component,
            variants: response.variants || [],
          },
        });
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
}

// Start extraction mode: enable listeners and overlay
function startExtraction() {
  if (isExtracting) return;
  isExtracting = true;
  ensureHoverOverlay();
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
}

// Stop extraction mode and hide overlay
function stopExtraction() {
  if (!isExtracting) return;
  isExtracting = false;
  removeHoverOverlay();
  document.removeEventListener("mousemove", handleMouseMove, true);
  document.removeEventListener("click", handleClick, true);
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
