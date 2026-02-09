import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/theme.css"; // ✅ only import the real theme file

// ✅ Force full-width even if some CSS exists elsewhere
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

rootEl.style.width = "100%";
rootEl.style.maxWidth = "none";
rootEl.style.margin = "0";
rootEl.style.padding = "0";
rootEl.style.minHeight = "100vh";

document.body.style.margin = "0";
document.body.style.width = "100%";

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
