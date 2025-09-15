import React from 'react';
import ReactDOM from 'react-dom/client';
import Options from './options/Options';
import './options/styles/options.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);