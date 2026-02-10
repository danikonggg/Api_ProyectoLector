import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, setBaseUrl } from '../api/api';
import { setToken, setUser } from '../api/api';

export default function Login() {
  const defaultUrl = typeof window !== 'undefined' && window.location.port === '5173'
    ? window.location.origin
    : 'http://localhost:3000';
  const [baseUrl, setBaseUrlState] = useState(localStorage.getItem('api_lector_base_url') || defaultUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!baseUrl.trim()) {
      setError('Indica la URL de la API');
      return;
    }
    if (!email.trim() || !password) {
      setError('Correo y contraseña obligatorios');
      return;
    }
    setLoading(true);
    try {
      setBaseUrl(baseUrl);
      const loginRes = await api('POST', '/auth/login', { email: email.trim(), password });
      const token = loginRes.access_token || '';
      setToken(token);
      const profileRes = await api('GET', '/auth/profile');
      const user = profileRes?.data ?? null;
      setUser(user);
      login(token, user);
      const role = (user?.tipoPersona || '').toLowerCase();
      if (role === 'administrador') navigate('/admin');
      else if (role === 'director') navigate('/director');
      else if (role === 'maestro') navigate('/maestro');
      else navigate('/');
    } catch (e) {
      setError(e?.data?.message || e?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'linear-gradient(135deg, var(--bg) 0%, #1a1a20 100%)',
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>API Lector</h1>
          <p style={{ color: 'var(--text-muted)' }}>Inicia sesión con tu cuenta</p>
          <Link to="/pruebas" style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>🧪 Ir a pruebas de registro</Link>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label>
              <span>URL de la API</span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrlState(e.target.value)}
                placeholder={defaultUrl}
              />
              {defaultUrl.includes('5173') && (
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                  Usa esta URL para que el proxy evite CORS (API debe estar en :3000)
                </small>
              )}
            </label>
            <label>
              <span>Correo</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
              />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
