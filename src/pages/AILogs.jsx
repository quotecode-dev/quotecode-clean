import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function AILogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setLogs(data);
      setLoading(false);
    }
    fetchLogs();
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', background: '#f8fafc', minHeight: '100vh' }} dir="rtl">
      <div style={{ maxWidth: '1100px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ color: '#1e293b', fontSize: '1.5rem', margin: 0 }}>יומן שאלות ותשובות AI (AI Support Logs)</h1>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            חזרה לדשבורד
          </button>
        </div>
        {loading ? <p>טוען נתונים...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'right', color: '#475569', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px' }}>זמן</th>
                <th style={{ padding: '12px' }}>אימייל משתמש</th>
                <th style={{ padding: '12px' }}>שאלת הלקוח</th>
                <th style={{ padding: '12px' }}>תשובת ה-AI</th>
                <th style={{ padding: '12px' }}>קטגוריה</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isCritical = log.category !== 'GENERAL';
                return (
                  <tr key={log.id} style={{ 
                    borderBottom: '1px solid #e2e8f0', 
                    color: isCritical ? '#dc2626' : '#000000',
                    fontWeight: isCritical ? 'bold' : 'normal',
                    fontSize: '0.9rem'
                  }}>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>{log.user_email}</td>
                    <td style={{ padding: '12px' }}>{log.user_question}</td>
                    <td style={{ padding: '12px', color: '#334155', fontSize: '0.85rem' }}>{log.ai_response}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        background: isCritical ? '#fee2e2' : '#f1f5f9', 
                        color: isCritical ? '#991b1b' : '#334155',
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block' 
                      }}>
                        {log.category}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}