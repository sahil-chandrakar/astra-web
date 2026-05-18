const injectedAttributeNames = new Set([
  "bis_skin_checked",
  "bis_register",
  "bis_use",
  "data-bis-config",
  "data-dynamic-id",
  "data-new-gr-c-s-check-loaded",
  "data-gr-ext-installed",
]);

function isInjectedAttribute(name: string) {
  return injectedAttributeNames.has(name) || /^__processed_[\w-]+__$/.test(name);
}

function cleanElement(element: Element) {
  for (const attribute of Array.from(element.attributes)) {
    if (isInjectedAttribute(attribute.name)) {
      element.removeAttribute(attribute.name);
    }
  }
}

function cleanTree(root: ParentNode | Element | null) {
  if (!root) return;
  if (root instanceof Element) cleanElement(root);
  root.querySelectorAll?.("*").forEach(cleanElement);
}

function isExtensionHydrationWarning(args: unknown[]) {
  const text = args
    .map((arg) => (typeof arg === "string" ? arg : arg instanceof Error ? arg.message : ""))
    .join(" ");

  return (
    text.includes("A tree hydrated but some attributes") &&
    (text.includes("bis_skin_checked") ||
      text.includes("bis_use") ||
      text.includes("data-bis-config") ||
      text.includes("chrome-extension://") ||
      text.includes("__processed_"))
  );
}

if (typeof window !== "undefined") {
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (isExtensionHydrationWarning(args)) return;
    originalError(...args);
  };

  const runClean = () => cleanTree(document.documentElement);
  queueMicrotask(runClean);
  document.addEventListener("DOMContentLoaded", runClean, { once: true });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName && isInjectedAttribute(mutation.attributeName)) {
        (mutation.target as Element).removeAttribute(mutation.attributeName);
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) cleanTree(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  window.addEventListener("load", runClean);
  (window as Window & { __astraHydrationGuard?: () => void }).__astraHydrationGuard = runClean;
}
