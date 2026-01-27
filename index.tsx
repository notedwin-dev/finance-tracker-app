import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { AuthProvider } from './services/auth';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Fallback to hardcoded ID if env var is not present in the environment
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '727983171082-shiicmce4p9623q0cuk0s93886reefvt.apps.googleusercontent.com';

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
  </React.StrictMode>
);