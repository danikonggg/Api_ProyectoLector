import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function DirectorDashboard() {
  const { user } = useAuth();
  const escuelaId = user?.director?.escuelaId ?? user?.director?.escuela?.id;

  return (
    <Layout title="Mi escuela" badge="director" sidebarItems={[]}>
      <DirectorContent escuelaId={escuelaId} />
    </Layout>
  );
}

function DirectorContent({ escuelaId }) {
  const [libros, setLibros] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [maestros, setMaestros] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codigoCanjear, setCodigoCanjear] = useState('');
  const [formMaestro, setFormMaestro] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', especialidad: '' });
  const [formAlumno, setFormAlumno] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', grado: '', grupo: '' });

  const loadAll = async () => {
    if (!escuelaId) return;
    setLoading(true);
    try {
      const [lib, pend, mas, alum] = await Promise.all([
        api('GET', `/escuelas/${escuelaId}/libros`),
        api('GET', `/escuelas/${escuelaId}/libros/pendientes`),
        api('GET', `/escuelas/${escuelaId}/maestros`),
        api('GET', `/escuelas/${escuelaId}/alumnos`),
      ]);
      setLibros(lib?.data || []);
      setPendientes(pend?.data || []);
      setMaestros(mas?.data || []);
      setAlumnos(alum?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [escuelaId]);

  const canjearLibro = async (e) => {
    e.preventDefault();
    if (!codigoCanjear.trim() || !escuelaId) return;
    setMsg(null);
    try {
      await api('POST', `/escuelas/${escuelaId}/libros/canjear`, { codigo: codigoCanjear.trim() });
      setMsg({ type: 'success', text: 'Libro canjeado correctamente' });
      setCodigoCanjear('');
      loadAll();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const registrarMaestro = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api('POST', '/personas/registro-maestro', formMaestro);
      setMsg({ type: 'success', text: 'Maestro registrado' });
      setFormMaestro({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', especialidad: '' });
      loadAll();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const registrarAlumno = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const payload = { ...formAlumno };
      if (payload.grado) payload.grado = Number(payload.grado);
      await api('POST', '/personas/registro-alumno', payload);
      setMsg({ type: 'success', text: 'Alumno registrado' });
      setFormAlumno({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', grado: '', grupo: '' });
      loadAll();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  if (!escuelaId) {
    return <div className="alert alert-error">No se encontró escuela. Contacta al administrador.</div>;
  }

  return (
    <>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3>Canjear libro</h3>
        <p className="card-desc">Introduce el código que el admin te otorgó.</p>
        <form onSubmit={canjearLibro} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Código</span>
            <input value={codigoCanjear} onChange={(e) => setCodigoCanjear(e.target.value)} placeholder="LIB-..." style={{ width: '100%' }} required />
          </label>
          <button type="submit" className="btn btn-primary">Canjear</button>
        </form>
      </div>

      <div className="card">
        <h3>Libros pendientes de canjear</h3>
        <p className="card-desc">Solo ves título y grado. Pide el código al admin.</p>
        {pendientes.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Ninguno pendiente.</p> : (
          pendientes.map((p, i) => (
            <div key={i} className="list-item">
              <div>
                <h4>{p.titulo}</h4>
                <span className="meta">Grado {p.grado}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Libros activos</h3>
        {libros.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Ninguno. Canjea un libro.</p> : (
          libros.map((l) => (
            <div key={l.id} className="list-item">
              <div>
                <h4>{l.titulo}</h4>
                <span className="meta">Grado {l.grado} · {l.codigo}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Registrar maestro</h3>
        <p className="card-desc">No necesitas idEscuela; se usa tu escuela.</p>
        <form onSubmit={registrarMaestro} className="form-grid">
          {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono', 'especialidad'].map((k) => (
            <label key={k}><span>{k}</span><input value={formMaestro[k]} onChange={(e) => setFormMaestro({ ...formMaestro, [k]: e.target.value })} required={['nombre','apellidoPaterno','apellidoMaterno','email','password'].includes(k)} /></label>
          ))}
        </form>
        <button type="submit" className="btn btn-primary">Registrar</button>
      </div>

      <div className="card">
        <h3>Registrar alumno</h3>
        <p className="card-desc">No necesitas idEscuela.</p>
        <form onSubmit={registrarAlumno} className="form-grid">
          {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono', 'grado', 'grupo'].map((k) => (
            <label key={k}><span>{k}</span><input value={formAlumno[k]} onChange={(e) => setFormAlumno({ ...formAlumno, [k]: e.target.value })} required={['nombre','apellidoPaterno','apellidoMaterno','email','password'].includes(k)} /></label>
          ))}
        </form>
        <button type="submit" className="btn btn-primary">Registrar</button>
      </div>

      <div className="card">
        <h3>Maestros</h3>
        {maestros.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Sin maestros.</p> : maestros.map((m) => (
          <div key={m.id} className="list-item">
            <h4>{m.persona?.nombre} {m.persona?.apellido}</h4>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Alumnos</h3>
        {alumnos.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Sin alumnos.</p> : alumnos.map((a) => (
          <div key={a.id} className="list-item">
            <h4>{a.persona?.nombre} {a.persona?.apellido}</h4>
            <span className="meta">Grado {a.grado}</span>
          </div>
        ))}
      </div>
    </>
  );
}
