import { Navigate } from 'react-router-dom';

// Legacy /ai-logs URL: there is NO second UI implementation any more. AI
// Support Logs is an ordinary Admin destination inside the unified shell
// (components/AISupportLogsContent.jsx); this route only rebinds old
// bookmarks/links into that destination. Access is decided by the Dashboard
// (Super Admin only) and, for the data, by server-side RLS.
export default function AILogs() {
  return <Navigate to="/dashboard?view=admin&section=ai-support" replace />;
}
