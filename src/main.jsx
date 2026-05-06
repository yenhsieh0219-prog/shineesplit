import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 這裡會指向你剛才取代的那個 App.jsx
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>,
)