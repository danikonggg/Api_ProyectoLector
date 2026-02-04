import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children, sidebarItems = [], title, badge }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>API Lector</span>
          {badge && <span className={`badge badge-${badge}`}>{badge}</span>}
        </div>
        {sidebarItems.map((item) =>
          item.onClick !== undefined ? (
            <button key={item.label} onClick={item.onClick} className={item.active ? 'active' : ''} style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'inherit', cursor: 'pointer' }}>
              {item.icon}
              {item.label}
            </button>
          ) : (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.icon}
              {item.label}
            </NavLink>
          )
        )}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">
        <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{title}</h1>
          {user && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {user.nombre} {user.apellido}
            </span>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}
