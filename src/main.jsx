// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.jsx";
import "./index.css";
import "./theme.css";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const orgId = import.meta.env.VITE_AUTH0_ORG_ID;

const redirectUri =
  import.meta.env.VITE_AUTH0_REDIRECT_URI || `${window.location.origin}/`;

if (!domain || !clientId || !audience) {
  console.warn("Missing Auth0 env vars:", { domain, clientId, audience, redirectUri, orgId });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience,
        scope: "openid profile email offline_access",
        ...(orgId ? { organization: orgId } : {}),
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);