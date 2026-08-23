import { useState, useRef, useEffect } from 'react';
import { supabase } from './shared/supabase';
import { Bot, X, Send } from 'lucide-react';
import { NEON } from './theme/neonTheme';

export default function AIChatWidget({ isHebrew = true, isDashboard = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      } catch (e) {
        console.error("Error fetching user session:", e);
      }
    }
    fetchUser();
  }, []);

  const [messages, setMessages] = useState(() => {
    const defaultWelcome = isHebrew
      ? (isDashboard ? 'שלום! אני עוזר ה-AI של ProFlow. איך אעזור לך בממשק המערכת היום?' : 'שלום! אני עוזר ה-AI של ProFlow. יש לך שאלות על המחירים, המסלולים או הפיצ\'רים שלנו?')
      : (isDashboard ? 'Hello! I am ProFlow AI assistant. How can I help you with the interface today?' : 'Hello! I am ProFlow AI assistant. Have questions about our pricing, plans, or features?');

    try {
      const storageKey = (isDashboard ? 'proflow_ai_chat_app_' : 'proflow_ai_chat_public_') + (isHebrew ? 'he' : 'en');
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          if (parsed[0].role === 'assistant') {
            parsed[0].content = defaultWelcome;
          }
          // ניקוי מוחלט של היסטוריית שיחות ישנה מקאש מקומי
          return parsed.map(msg => {
            if (msg.role === 'assistant') {
              if (!isHebrew) {
                msg.content = msg.content.replace(/support@quotecodepro\.com/gi, 'info@quotecodepro.com');
              } else {
                msg.content = msg.content.replace(/info@quotecodepro\.com/gi, 'support@quotecodepro.com');
              }
            }
            return msg;
          });
        }
      }
    } catch { /* ignore */ }
    return [
      { role: 'assistant', content: defaultWelcome }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleOpenExternalChat = () => setIsOpen(true);
    window.addEventListener('open-proflow-ai-chat', handleOpenExternalChat);
    return () => window.removeEventListener('open-proflow-ai-chat', handleOpenExternalChat);
  }, []);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    try {
      const storageKey = (isDashboard ? 'proflow_ai_chat_app_' : 'proflow_ai_chat_public_') + (isHebrew ? 'he' : 'en');
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch { /* ignore */ }
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isDashboard, isHebrew]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: {
          messages: apiMessages,
          isHebrew: Boolean(isHebrew),
          isDashboard: Boolean(isDashboard),
          userEmail: userEmail || (isDashboard ? 'logged_in_user_unknown' : 'anonymous_public_user')
        }
      });

      if (error) throw error;

      if (data && data.choices && data.choices.length > 0) {
        let aiReply = data.choices[0].message.content;

        // 🚨 נשק יום הדין: דורסים את התשובה בכוח בפרונטאנד! 🚨
        if (!isHebrew) {
          aiReply = aiReply.replace(/support@quotecodepro\.com/gi, 'info@quotecodepro.com');
        } else {
          aiReply = aiReply.replace(/info@quotecodepro\.com/gi, 'support@quotecodepro.com');
        }

        setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
      } else {
        throw new Error('Invalid response format from AI');
      }

    } catch (err) {
      console.error("AI Chat Error:", err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isHebrew
          ? 'מצטער, חלה שגיאה זמנית בחיבור לשרת ה-AI. אנא נסה שוב בעוד מספר שניות.'
          : 'Sorry, there was a temporary error connecting to the AI server. Please try again in a few seconds.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print ai-chat-container" style={{
      position: 'fixed',
      bottom: '24px',
      left: 0,
      right: 0,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 999999
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1050px',
        padding: '0 20px',
        display: 'flex',
        justifyContent: isHebrew ? 'flex-start' : 'flex-start',
      }}>
        <div style={{
          position: 'relative',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isHebrew ? 'flex-start' : 'flex-start'
        }}>

          <style>{`
            @media (max-width: 768px) {
              .ai-chat-container {
                bottom: 85px !important;
              }
              .ai-chat-popup {
                position: fixed !important;
                top: 0 !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100% !important;
                height: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                margin: 0 !important;
                border-radius: 0 !important;
                box-sizing: border-box !important;
                z-index: 999999 !important;
                transform: none !important;
              }
            }
          `}</style>

          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="ai-support-btn"
              style={{
                background: NEON.gradient,
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                boxShadow: NEON.glow,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Bot size={20} strokeWidth={2.2} />
              <span className="ai-btn-text" style={{ whiteSpace: 'nowrap' }}>{isHebrew ? 'צאט AI' : 'AI Chat'}</span>
            </button>
          )}

          {isOpen && (
            <div className="ai-chat-popup" style={{
              position: 'absolute',
              bottom: 'calc(100% + 15px)',
              [isHebrew ? 'right' : 'left']: '0',
              width: '360px',
              height: '520px',
              background: NEON.bgElevated,
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              border: `1px solid ${NEON.border}`,
              overflow: 'hidden',
              textAlign: isHebrew ? 'right' : 'left'
            }} dir={isHebrew ? 'rtl' : 'ltr'}>
              <div style={{
                background: NEON.gradient,
                color: 'white',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={17} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{isHebrew ? 'שירות לקוחות ProFlow' : 'ProFlow Support'}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                      {isHebrew ? 'זמין 24/7' : 'Available 24/7'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex' }}
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div
                ref={scrollContainerRef}
                style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: NEON.bg }}
              >
                {messages.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === 'user' ? (isHebrew ? 'flex-start' : 'flex-end') : (isHebrew ? 'flex-end' : 'flex-start'),
                    background: msg.role === 'user' ? NEON.gradient : NEON.bgCard,
                    color: msg.role === 'user' ? 'white' : NEON.textPrimary,
                    padding: '10px 14px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    fontSize: '0.85rem',
                    border: msg.role === 'assistant' ? `1px solid ${NEON.border}` : 'none',
                    lineHeight: '1.4',
                    textAlign: isHebrew ? 'right' : 'left'
                  }}>
                    {msg.content}
                  </div>
                ))}
                {loading && (
                  <div style={{ alignSelf: isHebrew ? 'flex-end' : 'flex-start', background: NEON.bgCard, padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem', color: NEON.textSecondary, border: `1px solid ${NEON.border}` }}>
                    {isHebrew ? 'מקליד תשובה...' : 'Typing...'}
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} style={{ padding: '10px', background: NEON.bgElevated, borderTop: `1px solid ${NEON.border}`, display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isHebrew ? 'שאל משהו...' : 'Ask something...'}
                  style={{ flex: 1, padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.85rem', outline: 'none', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary }}
                />
                <button
                  type="submit"
                  style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: NEON.glowSoft }}
                >
                  <Send size={15} strokeWidth={2.5} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
