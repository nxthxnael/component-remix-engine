// popup.js - UI logic for Component Remix Engine (CRE)
// Handles settings, extraction toggle, library search & CRUD, and export.

import {
  getAllComponents,
  saveComponent,
  deleteComponent,
  updateComponent
} from './utils/storage.js';
import { generateCodeForFramework } from './utils/codegen.js';
import { showToast } from './utils/toast.js';

let latestComponentPayload = null; // { original, variants }
let allComponents = [];
let currentSearch = '';
let defaultFramework = 'react';

// Listen for messages to keep latest extracted component in sync
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'CRE_LATEST_COMPONENT') {
    latestComponentPayload = message.payload;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  wireSettings();
  wireExtractionToggle();
  wireSearch();
  wireSaveLatest();
  await loadComponentsAndRender();
});

async function wireSettings() {
  const apiKeyInput = document.getElementById('cre-api-key');
  const saveBtn = document.getElementById('cre-save-settings');
  const frameworkSelect = document.getElementById('cre-framework-select');

  // Load stored settings
  chrome.storage.sync.get(['creSettings'], (result) => {
    const settings = result?.creSettings || {};
    if (settings.openaiApiKey) {
      apiKeyInput.value = settings.openaiApiKey;
    } else {
      apiKeyInput.value = 'sk-dummykey1234567890';
    }
    if (settings.defaultFramework) {
      frameworkSelect.value = settings.defaultFramework;
      defaultFramework = settings.defaultFramework;
    }
  });

  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const framework = frameworkSelect.value;

    chrome.storage.sync.set(
      {
        creSettings: {
          openaiApiKey: key,
          defaultFramework: framework
        }
      },
      () => {
        defaultFramework = framework;
        showToast('Settings saved.');
      }
    );
  });

  frameworkSelect.addEventListener('change', () => {
    defaultFramework = frameworkSelect.value;
  });
}

function wireExtractionToggle() {
  const btn = document.getElementById('cre-toggle-extraction');

  btn.addEventListener('click', () => {
    const starting = btn.dataset.state !== 'on';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      chrome.tabs.sendMessage(
        tab.id,
        { type: starting ? 'START_EXTRACTION' : 'STOP_EXTRACTION' },
        () => {
          const on = starting;
          btn.dataset.state = on ? 'on' : 'off';
          btn.textContent = on ? 'Stop extraction' : 'Start extraction';
        }
      );
    });
  });
}

function wireSearch() {
  const searchInput = document.getElementById('cre-search');
  searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value.toLowerCase();
    renderLibrary();
  });
}

function wireSaveLatest() {
  const btn = document.getElementById('cre-save-latest');
  btn.addEventListener('click', async () => {
    if (!latestComponentPayload || !latestComponentPayload.original) {
      showToast('No extracted component available yet.');
      return;
    }

    const name = prompt('Name for this component?', 'My Component');
    if (!name) return;
    const tagsInput = prompt('Tags (comma separated)?', 'extracted, remix');
    const tags = (tagsInput || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const base = latestComponentPayload.original;
    const variants = latestComponentPayload.variants || [];

    // Pick first variant when available, else original
    const preferredVariant = variants[0] || { html: base.html, css: base.css };
    const framework = defaultFramework;
    const code = generateCodeForFramework(framework, preferredVariant, name);

    const saved = await saveComponent({
      name,
      tags,
      originalHTML: base.html,
      originalCSS: base.css,
      remixedVariants: variants,
      generatedCode: code,
      framework
    });

    allComponents.push(saved);
    renderLibrary();
    showToast('Component saved to library.');
  });
}

async function loadComponentsAndRender() {
  allComponents = await getAllComponents();
  renderLibrary();
}

function renderLibrary() {
  const grid = document.getElementById('cre-library-grid');
  const empty = document.getElementById('cre-library-empty');

  grid.innerHTML = '';

  const filtered = allComponents.filter((c) => {
    if (!currentSearch) return true;
    const haystack = `${c.name} ${(c.tags || []).join(' ')}`.toLowerCase();
    return haystack.includes(currentSearch);
  });

  if (!filtered.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach((comp) => {
    const card = document.createElement('div');
    card.className = 'cre-card';

    const header = document.createElement('div');
    header.className = 'cre-card-header';
    const nameEl = document.createElement('div');
    nameEl.className = 'cre-card-name';
    nameEl.textContent = comp.name;
    const frameworkEl = document.createElement('div');
    frameworkEl.className = 'cre-card-meta';
    frameworkEl.textContent = comp.framework.toUpperCase();
    header.appendChild(nameEl);
    header.appendChild(frameworkEl);

    const tagsRow = document.createElement('div');
    tagsRow.className = 'cre-card-tags';
    (comp.tags || []).forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'cre-tag-pill';
      pill.textContent = tag;
      tagsRow.appendChild(pill);
    });

    const meta = document.createElement('div');
    meta.className = 'cre-card-meta';
    const createdDate = comp.createdAt ? new Date(comp.createdAt) : null;
    if (createdDate) {
      meta.textContent = `Saved ${createdDate.toLocaleString()}`;
    }

    const preview = document.createElement('div');
    preview.className = 'cre-card-preview';
    preview.innerHTML = comp.originalHTML || '';

    const styleEl = document.createElement('style');
    styleEl.textContent = comp.originalCSS || '';
    preview.appendChild(styleEl);

    const actions = document.createElement('div');
    actions.className = 'cre-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'cre-btn cre-btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => handleEditComponent(comp));

    const exportBtn = document.createElement('button');
    exportBtn.className = 'cre-btn cre-btn-secondary';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => handleExportComponent(comp));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'cre-btn cre-btn-secondary';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${comp.name}" from library?`)) return;
      await deleteComponent(comp.id);
      allComponents = allComponents.filter((c) => c.id !== comp.id);
      renderLibrary();
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

function handleEditComponent(comp) {
  const newName = prompt('Rename component:', comp.name);
  if (!newName) return;
  const newTagsRaw = prompt(
    'Edit tags (comma separated):',
    (comp.tags || []).join(', ')
  );
  const newTags = (newTagsRaw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const updated = { ...comp, name: newName, tags: newTags };
  updateComponent(updated.id, updated).then(() => {
    const idx = allComponents.findIndex((c) => c.id === comp.id);
    if (idx >= 0) {
      allComponents[idx] = updated;
    }
    renderLibrary();
    showToast('Component updated.');
  });
}

function handleExportComponent(comp) {
  const framework = comp.framework || 'react';
  const code = comp.generatedCode || generateCodeForFramework(framework, {
    html: comp.originalHTML,
    css: comp.originalCSS
  });

  const action = prompt('Export: "c" to copy to clipboard, "d" to download file.', 'c');
  if (!action) return;

  if (action.toLowerCase() === 'c') {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        showToast(
          'Code copied. Respect copyrights when reusing extracted components.'
        );
      })
      .catch(() => {
        showToast('Clipboard copy failed in this context.');
      });
  } else if (action.toLowerCase() === 'd') {
    const { filename, blob } = buildDownloadBlob(framework, code, comp);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Download started. Respect copyrights when reusing.');
  }
}

function buildDownloadBlob(framework, code, comp) {
  let filename = comp.name.replace(/\s+/g, '') || 'Component';
  let ext = '.jsx';
  if (framework === 'vue') {
    ext = '.vue';
  } else if (framework === 'html') {
    ext = '.html';
  }
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  return { filename: `${filename}${ext}`, blob };
}


