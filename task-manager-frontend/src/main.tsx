import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import TaskContextProvider from './context/TaskContext.tsx'

const root = document.getElementById('root') || document.body;
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <TaskContextProvider>
        <App />
      </TaskContextProvider>
    </BrowserRouter>
  </StrictMode>,
)
