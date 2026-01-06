// utils/toast.js
// Simple toast utility for the popup (does not run in content scripts).

export function showToast(message) {
  const existing = document.querySelector(".cre-toast");
  if (existing) {
    existing.remove();
  }

  const el = document.createElement("div");
  el.className = "cre-toast";
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s ease-out";
    setTimeout(() => {
      el.remove();
    }, 320);
  }, 2000);
}
