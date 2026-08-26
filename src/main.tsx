import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/controls.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element missing from index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
