import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import Home from './pages/Home';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    const role = (user.tipoPersona || '').toLowerCase();
    if (!roles.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export default function App() {
  const { user } = useAuth();
  const role = (user?.tipoPersona || '').toLowerCase();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={role === 'administrador' ? '/admin' : role === 'director' ? '/director' : role === 'maestro' ? '/maestro' : '/'} replace /> : <Login />} />
      <Route path="/admin" element={<ProtectedRoute roles={['administrador']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/director" element={<ProtectedRoute roles={['director']}><DirectorDashboard /></ProtectedRoute>} />
      <Route path="/maestro" element={<ProtectedRoute roles={['maestro']}><MaestroDashboard /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
