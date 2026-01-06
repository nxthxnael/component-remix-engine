// utils/storage.js
// Helpers around chrome.storage.sync for persisting component library entries.

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

export async function getAllComponents() {
  return withSyncStorage((raw) => raw[STORAGE_KEY] || []);
}

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

export async function deleteComponent(id) {
  const current = await getAllComponents();
  const next = current.filter((c) => c.id !== id);
  await setSyncStorage(next);
}

export async function searchComponents(query) {
  const all = await getAllComponents();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter((c) => {
    const haystack = `${c.name} ${(c.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(q);
  });
}
