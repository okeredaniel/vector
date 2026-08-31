import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Show the window after the app has actually painted,
// so we skip straight from hidden -> fully rendered (no white flash)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    invoke("show_window");
  });
});