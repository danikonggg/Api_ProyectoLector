import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Pruebas from './pages/Pruebas';
import AdminDashboard from './pages/AdminDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import Home from './pages/Home';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-border border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm">Cargando...</p>
        </div>
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
      <Route path="/pruebas" element={<Pruebas />} />
      <Route path="/login" element={user ? <Navigate to={role === 'administrador' ? '/admin' : role === 'director' ? '/director' : role === 'maestro' ? '/maestro' : '/'} replace /> : <Login />} />
      <Route path="/admin" element={<ProtectedRoute roles={['administrador']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/director" element={<ProtectedRoute roles={['director']}><DirectorDashboard /></ProtectedRoute>} />
      <Route path="/maestro" element={<ProtectedRoute roles={['maestro']}><MaestroDashboard /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
