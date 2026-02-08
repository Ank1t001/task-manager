import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// ✅ Force full-width even if some CSS exists elsewhere
const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.style.width = "100%";
  rootEl.style.maxWidth = "none";
  rootEl.style.margin = "0";
  rootEl.style.padding = "0";
  rootEl.style.minHeight = "100vh";
}

document.body.style.margin = "0";
document.body.style.width = "100%";

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
