import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { StrictMode } from "react";

const legacyHosts = new Set(["subterra-torneos.web.app", "subterra-torneos.firebaseapp.com"]);

// Redirige los dominios gratuitos de Firebase al dominio principal sin perder ruta, query ni hash.
if (legacyHosts.has(window.location.hostname)) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.protocol = "https:";
  canonicalUrl.hostname = "subterratorneo.es";
  window.location.replace(canonicalUrl.toString());
}

// Punto de entrada de React: monta toda la aplicacion dentro del div #root.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
