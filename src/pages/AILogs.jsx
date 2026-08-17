import React, { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import { formatDateLocal } from '../utils/regionConfig';

export default function AILogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null); // לפתיחת המלל המלא במודל

  // שדות סינון ומיון
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        setLogs(data);
      } else if (error) {
        console.error('Error fetching chat logs:', error.message);
      }
      setLoading(false);
    }
    fetchLogs();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // סינון ומיון הלוגים
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.user_question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.ai_response || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'ALL' || (log.category || 'GENERAL') === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    let aVal = a[sortField] || '';
    let bVal = b[sortField] || '';

    if (sortField === 'created_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else {
      aVal = aVal.toString().toLowerCase();
      bVal = bVal.toString().toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const categories = ['ALL', ...new Set(logs.map(l => l.category || 'GENERAL'))];

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', background: '#f8fafc', minHeight: '100vh' }} dir="rtl">
      
      {/* מודל צף לקריאת מלוא המלל בלחיצה על שורה */}
      {selectedLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '650px', maxHeight: '85vh', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflowY: 'auto', textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>פרטי לוג מלאים</h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ color: '#475569', display: 'block', fontSize: '0.85rem' }}>זמן:</strong>
              <span style={{ color: '#1e293b', fontSize: '0.95rem' }} dir="ltr">{selectedLog.created_at ? formatDateLocal(selectedLog.created_at, true) : ''}</span>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ color: '#475569', display: 'block', fontSize: '0.85rem' }}>אימייל משתמש:</strong>
              <span style={{ color: '#1e293b', fontSize: '0.95rem' }} dir="ltr">{selectedLog.user_email}</span>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ color: '#475569', display: 'block', fontSize: '0.85rem' }}>קטגוריה:</strong>
              <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#334155', fontSize: '0.85rem' }}>{selectedLog.category || 'GENERAL'}</span>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ color: '#475569', display: 'block', fontSize: '0.85rem' }}>שאלת הלקוח:</strong>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1e293b', whiteSpace: 'pre-wrap', marginTop: '4px', fontSize: '0.95rem' }}>{selectedLog.user_question}</div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ color: '#475569', display: 'block', fontSize: '0.85rem' }}>תשובת ה-AI:</strong>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1e293b', whiteSpace: 'pre-wrap', marginTop: '4px', fontSize: '0.95rem' }}>{selectedLog.ai_response}</div>
            </div>
            <button onClick={() => setSelectedLog(null)} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>סגור</button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ color: '#1e293b', fontSize: '1.5rem', margin: 0 }}>יומן שאלות ותשובות AI (AI Support Logs)</h1>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            חזרה לדשבורד
          </button>
        </div>

        {/* סרגל חיפוש וסינון קטגוריות */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="חיפוש לפי שאלה, אימייל או תשובה..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '280px', fontSize: '0.9rem' }}
          />
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', background: 'white' }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>קטגוריה: {cat}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>טוען נתונים...</p>
        ) : (
          filteredLogs.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>אין לוגים תואמים לחיפוש.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'right', color: '#475569', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('created_at')}>
                      זמן {sortField === 'created_at' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('user_email')}>
                      אימייל משתמש {sortField === 'user_email' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('user_question')}>
                      שאלת הלקוח {sortField === 'user_question' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('ai_response')}>
                      תשובת ה-AI {sortField === 'ai_response' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('category')}>
                      קטגוריה {sortField === 'category' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const isCritical = log.category && log.category !== 'GENERAL';
                    return (
                      <tr 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        title="לחץ לצפייה במלוא המלל"
                        style={{ 
                          borderBottom: '1px solid #e2e8f0', 
                          color: isCritical ? '#dc2626' : '#000000',
                          fontWeight: isCritical ? 'bold' : 'normal',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                          {log.created_at ? formatDateLocal(log.created_at, true) : ''}
                        </td>
                        <td style={{ padding: '12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="ltr">
                          {log.user_email || '-'}
                        </td>
                        <td style={{ padding: '12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.user_question || '-'}
                        </td>
                        <td style={{ padding: '12px', color: '#334155', fontSize: '0.85rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.ai_response || '-'}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            background: isCritical ? '#fee2e2' : '#f1f5f9', 
                            color: isCritical ? '#991b1b' : '#334155',
                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block' 
                          }}>
                            {log.category || 'GENERAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}