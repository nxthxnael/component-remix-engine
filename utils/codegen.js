// utils/codegen.js
// Generate framework-specific code for React, Vue, or plain HTML + CSS.

function tryPrettier(code, parser) {
  try {
    // Prettier is loaded via script tags in popup.html and exposed on window
    if (typeof prettier !== "undefined" && prettier.format) {
      const parserModule =
        parser === "html" ? prettierPlugins.html : prettierPlugins.babel;
      return prettier.format(code, {
        parser,
        plugins: [parserModule],
        singleQuote: true,
      });
    }
  } catch (e) {
    console.warn("Prettier formatting failed:", e);
  }
  return code;
}

function toReactComponent(variant, name) {
  const safeName =
    (name || "MyComponent").replace(/[^a-zA-Z0-9]/g, "") || "MyComponent";
  const jsx = variant.html || "";
  const css = variant.css || "";

  let code = `
import React from 'react';
import './${safeName}.css';

// Props can be extended as needed
export function ${safeName}(props) {
  return (
    <>
      ${jsx}
    </>
  );
}

// CSS for this component (place in ${safeName}.css)
/*
${css}
*/
`.trim();

  code = tryPrettier(code, "babel");
  return code;
}

function toVueSFC(variant, name) {
  const safeName =
    (name || "MyComponent").replace(/[^a-zA-Z0-9]/g, "") || "MyComponent";
  const tpl = variant.html || "";
  const css = variant.css || "";

  let code = `
<template>
  ${tpl}
</template>

<script setup>
// Define props and logic as needed
</script>

<style scoped>
${css}
</style>
`.trim();

  code = tryPrettier(code, "html");
  return code;
}

function toHtmlCss(variant, name) {
  const html = variant.html || "";
  const css = variant.css || "";

  const code = `
<!-- ${name} -->
<style>
${css}
</style>

${html}
`.trim();

  return tryPrettier(code, "html");
}

export function generateCodeForFramework(
  framework,
  variant,
  name = "Component"
) {
  if (framework === "vue") {
    return toVueSFC(variant, name);
  }
  if (framework === "html") {
    return toHtmlCss(variant, name);
  }
  return toReactComponent(variant, name);
}
