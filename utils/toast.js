// utils/toast.js
// Simple toast notification utility for the popup.
// Displays temporary messages at the bottom of the popup window.
// Does not run in content scripts (popup only).

/**
 * Display a toast notification message.
 * Removes any existing toast before showing a new one.
 * Auto-dismisses after 2.5 seconds.
 * @param {string} message - Message text to display
 */
export function showToast(message) {
  if (!message || typeof message !== "string") {
    console.warn("CRE: Toast called with invalid message");
    return;
  }

  // Remove existing toast if present
  const existing = document.querySelector(".cre-toast");
  if (existing) {
    existing.remove();
  }

  // Create new toast element
  const el = document.createElement("div");
  el.className = "cre-toast";
  el.textContent = message;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);

  // Trigger animation (small delay for CSS transition)
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });

  // Auto-dismiss after 2.5 seconds
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      if (el.parentNode) {
        el.remove();
      }
    }, 300); // Match CSS transition duration
  }, 2500);
}
