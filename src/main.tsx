import { createRoot } from "react-dom/client";
import "./index.css";
import "./aether.css";
import App from "./App";
import { StrictMode } from "react";
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => {
      registrations.forEach(registration => void registration.unregister());
    })
    .catch(() => {
      // La APK no necesita service worker; si falla, la app puede seguir arrancando.
    });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
