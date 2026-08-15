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
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1>AI Support Logs</h1>
      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Time</th>
              <th style={{ padding: '12px' }}>User</th>
              <th style={{ padding: '12px' }}>Question</th>
              <th style={{ padding: '12px' }}>Category</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const isCritical = log.category !== 'GENERAL';
              return (
                <tr key={log.id} style={{ 
                  borderBottom: '1px solid #e2e8f0', 
                  color: isCritical ? '#dc2626' : '#000',
                  fontWeight: isCritical ? 'bold' : 'normal'
                }}>
                  <td style={{ padding: '12px' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ padding: '12px' }}>{log.user_email}</td>
                  <td style={{ padding: '12px' }}>{log.user_question}</td>
                  <td style={{ padding: '12px' }}>{log.category}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}