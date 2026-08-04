import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminAuthProvider from "./context/AdminAuthContext";
import SiteSettingsProvider from "./context/SiteSettingsProvider";

createRoot(document.getElementById('root')).render(
  <AdminAuthProvider>
    <SiteSettingsProvider>
      <App />
    </SiteSettingsProvider>
  </AdminAuthProvider>,
)
