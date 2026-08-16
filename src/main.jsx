import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// ייבוא שתי האפליקציות המבודדות שלנו
import AppLocal from './local/AppLocal.jsx'
import AppGlobal from './global/AppGlobal.jsx'

// זיהוי האם מדובר בגרסה המקומית או הבינלאומית
// ניתן להתאים זאת לפי הדומיין שלך (למשל אם יש דומיין נפרד לישראל) או לפי הנתיב בפועל
const isLocalEnv = window.location.pathname.startsWith('/he') || 
                   window.location.hostname.includes('localtunnel') || 
                   localStorage.getItem('proflow_lang') === 'he';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isLocalEnv ? <AppLocal /> : <AppGlobal />}
  </StrictMode>,
)