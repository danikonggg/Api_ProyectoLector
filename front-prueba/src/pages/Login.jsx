import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, setBaseUrl, setToken, setUser } from '../api/api';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-[#15151b] to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Plataforma de lectura API Lector
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Inicia sesión
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Usa tu cuenta de administrador, director, maestro o alumno.
          </p>
          <Link
            to="/pruebas"
            className="mt-3 inline-flex text-xs text-emerald-400 hover:text-emerald-300"
          >
            🧪 Ir a pruebas de registro
          </Link>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="mt-1 text-[0.7rem] text-zinc-500">
                    Usa esta URL para que el proxy evite CORS (la API Nest debe estar en
                    <span className="font-mono px-1">:3000</span>
                  </p>
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

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[0.7rem] text-zinc-500">
          Recuerda mantener segura tu URL de API y tu token JWT.
        </p>
      </div>
    </div>
  );
}
