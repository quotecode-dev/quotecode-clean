import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// ייבוא שתי האפליקציות המבודדות שלנו
import AppLocal from './local/AppLocal.jsx'
import AppGlobal from './global/AppGlobal.jsx'

// ברירת מחדל אבסולוטית לעברית - אלא אם כן נכנסו במפורש לנתיב אנגלי
const isEnglishEnv = window.location.pathname.startsWith('/en') || 
                     localStorage.getItem('proflow_lang') === 'en';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isEnglishEnv ? <AppGlobal /> : <AppLocal />}
  </StrictMode>,
)