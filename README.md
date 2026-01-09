# Component Remix Engine (CRE)

A Chrome extension that lets you extract UI components from any webpage, remix them with AI using natural language prompts, generate code for React, Vue, or HTML/CSS, and manage a local component library.

## Features

- **Visual Element Extraction**: Hover to highlight and click to extract UI components from any webpage
- **AI-Powered Remixing**: Remix extracted components with natural language prompts (e.g., "add dark mode", "make it rounded")
- **Multi-Framework Code Generation**: Generate code for React (JSX), Vue (SFC), or HTML/CSS
- **Component Library**: Save, search, edit, and organize your extracted components
- **Easy Export**: Copy code to clipboard or download as files (.jsx, .vue, .html)
- **Offline-Capable**: Works offline for non-AI features; manual editing fallback when AI fails

## Installation

### Load Unpacked Extension

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the extension directory (`cre-extension` folder)
6. The extension icon should appear in your Chrome toolbar

### Setup API Key

1. Click the extension icon to open the popup
2. Enter your OpenAI API key in the settings (or use the dummy key `sk-dummykey1234567890` for testing)...working on the full implementation
3. Select your preferred default framework (React, Vue, or HTML/CSS)
4. Click "Save" to store your settings

**Note**: The dummy API key is for testing purposes only and will not work with actual AI remixing. For real AI features, you'll need a valid OpenAI API key from [platform.openai.com](https://platform.openai.com).

## Usage

### Extracting Components

1. Navigate to any webpage (e.g., [Bootstrap docs](https://getbootstrap.com/docs/))
2. Click the extension icon and press "Start extraction"
3. Hover over elements on the page - they'll be highlighted with a blue border
4. Click on the element you want to extract
5. The Component Remix Engine sidebar will appear on the right side of the page

### Remixing with AI

1. After extracting a component, you'll see it in the sidebar
2. Enter a remix prompt in the text area (e.g., "add dark mode and rounded corners")
3. Click "Remix with AI"
4. Wait for the AI to generate 3 variants of your remixed component
5. Preview the variants in the sidebar

### Saving to Library

1. Extract and optionally remix a component
2. Open the extension popup
3. Click "Save latest component"
4. Enter a name and tags (comma-separated)
5. The component will be saved to your local library

### Managing Your Library

- **Search**: Use the search bar to find components by name or tags
- **Edit**: Click "Edit" on any component card to rename or update tags
- **Export**: Click "Export" to copy code to clipboard or download as a file
  - You can choose which variant to export (original or any remixed variant)
  - Select "c" to copy or "d" to download
- **Delete**: Click "Delete" to remove a component from your library

### Generating Code

When you export a component, CRE automatically generates framework-specific code:

- **React**: Functional component with props support, includes CSS import
- **Vue**: Single File Component (SFC) with `<script setup>`, scoped styles
- **HTML/CSS**: Standalone HTML file with scoped CSS, ready to use

Code is formatted with Prettier when available, ensuring clean, readable output.

## Project Structure

```
cre-extension/
├── manifest.json          # Chrome extension manifest (MV3)
├── background.js          # Service worker for AI API calls
├── content.js             # Content script for extraction & sidebar
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic (library management)
├── popup.css              # Popup styling
├── utils/
│   ├── ai.js              # OpenAI API wrapper
│   ├── codegen.js         # Code generation (React/Vue/HTML)
│   ├── storage.js         # chrome.storage.sync helpers
│   ├── toast.js           # Toast notification utility
│   └── dom.js             # DOM utility helpers
└── icons/
    ├── icon16.png         # Extension icon (16x16)
    ├── icon48.png         # Extension icon (48x48)
    └── icon128.png        # Extension icon (128x128)
```

## Permissions

- `activeTab`: Access the current tab's content for extraction
- `tabs`: Query active tabs for extraction toggle
- `scripting`: Inject content scripts into web pages
- `storage`: Store component library and settings locally

## Limitations

- **AI Features**: Require valid OpenAI API key and internet connection
- **Extraction**: Works best on static sites; dynamic content may not extract perfectly
- **Copyright**: Always respect copyrights when reusing extracted components
- **Browser Compatibility**: Chrome/Chromium-based browsers only (Manifest V3)

## Troubleshooting

### Extraction Not Working

- Make sure you're on a regular webpage (not `chrome://` pages)
- Reload the page and try again
- Check browser console for errors (F12)

### AI Remix Failing

- Verify your OpenAI API key is correct in settings
- Check your internet connection
- Ensure you have API credits/quota available
- Try a different prompt if one fails

### Code Generation Issues

- Prettier formatting is optional; code will still generate without it
- Some complex HTML may not convert perfectly to JSX
- Manual editing is always an option in the exported code

### Library Not Saving

- Check Chrome storage quota (extensions have limited storage)
- Try reloading the extension
- Check browser console for storage errors

## Development

### Building

No build step required - the extension uses vanilla JavaScript with ES modules.

### Testing

1. Load the unpacked extension in Chrome
2. Test on static sites like:
   - [Bootstrap Documentation](https://getbootstrap.com/docs/)
   - [MDN Web Docs](https://developer.mozilla.org/)
   - [Tailwind CSS Examples](https://tailwindui.com/components)

### Code Style

- ES6+ JavaScript with modules
- Chrome Extension Manifest V3
- Prettier formatting (optional, loaded via CDN)
- JSDoc comments for documentation

## License

This project is provided as-is for educational and personal use. When extracting components from websites, always respect copyright and terms of service.

## Acknowledgments

- Uses OpenAI API for AI remixing features
- Prettier for code formatting (loaded via CDN)
- Built with Chrome Extension Manifest V3

## Support

For issues, questions, or contributions, please refer to the project repository.

---

**⚠️ Important**: Always respect copyrights when reusing extracted components. This tool is for inspiration and learning purposes. Ensure you have permission to use any components you extract from websites.
