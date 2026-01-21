// utils/toast.js
// Toast notification utility for the popup.
// Displays temporary messages at the bottom of the popup window.
// Supports different types: default, success, error, warning, and important.

/**
 * Display a toast notification message.
 * @param {string} message - Message text to display
 * @param {Object} [options] - Toast options
 * @param {'default'|'success'|'error'|'warning'} [options.type='default'] - Toast type
 * @param {boolean} [options.important=false] - Whether the toast is important
 * @param {number} [options.duration=3000] - Duration in milliseconds
 */
export function showToast(
  message,
  { type = "default", important = false, duration = 3000 } = {},
) {
  if (!message || typeof message !== "string") {
    console.warn("CRE: Toast called with invalid message");
    return;
  }

  // Remove existing toast if present
  const existing = document.querySelector(".cre-toast");
  if (existing) {
    const existingClone = existing.cloneNode(true);
    existing.style.transition = "all 0.2s ease";
    existing.style.opacity = "0";
    existing.style.transform = "translate(-50%, 20px)";
    setTimeout(() => existing.remove(), 200);
  }

  // Create new toast element
  const el = document.createElement("div");
  el.className = `cre-toast ${type !== "default" ? type : ""} ${important ? "important" : ""}`;

  // Create message content
  const messageEl = document.createElement("span");
  messageEl.className = "cre-toast-message";
  messageEl.textContent = message;

  // Add close button
  const closeButton = document.createElement("button");
  closeButton.className = "cre-toast-close";
  closeButton.innerHTML = "&times;";
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.onclick = () => dismissToast(el);

  el.appendChild(messageEl);
  el.appendChild(closeButton);

  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  document.body.appendChild(el);

  // Trigger animation
  requestAnimationFrame(() => {
    el.classList.add("show");
  });

  // Auto-dismiss if not important
  if (!important) {
    const dismissTimer = setTimeout(() => {
      dismissToast(el);
    }, duration);

    // Clear timeout on hover
    el.addEventListener("mouseenter", () => {
      clearTimeout(dismissTimer);
    });

    // Reset timeout on mouse leave
    el.addEventListener("mouseleave", () => {
      setTimeout(() => {
        dismissToast(el);
      }, 500);
    });
  }
}

/**
 * Dismiss a toast with animation
 * @param {HTMLElement} toastEl - The toast element to dismiss
 */
function dismissToast(toastEl) {
  if (!toastEl) return;

  toastEl.classList.remove("show");
  toastEl.style.opacity = "0";
  toastEl.style.transform = "translate(-50%, 20px)";

  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.remove();
    }
  }, 300); // Match CSS transition duration
}

// Convenience methods for different toast types
showToast.success = (message, options) =>
  showToast(message, { ...options, type: "success" });

showToast.error = (message, options) =>
  showToast(message, { ...options, type: "error" });

showToast.warning = (message, options) =>
  showToast(message, { ...options, type: "warning" });

export default showToast;
