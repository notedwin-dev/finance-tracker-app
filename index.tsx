/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./services/auth.services";

// Register Service Worker for PWA
registerSW({ immediate: true });

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider
      clientId={CLIENT_ID}
      children={
        <AuthProvider>
          <App />
        </AuthProvider>
      }
    />
  </React.StrictMode>,
);
