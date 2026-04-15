import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DCIDProvider } from './contexts/DCIDContext';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DCIDProvider>
      <App />
    </DCIDProvider>
  </React.StrictMode>
);
