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
  const [directores, setDirectores] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codigoCanjear, setCodigoCanjear] = useState('');
  const [formMaestro, setFormMaestro] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', especialidad: '' });
  const [formAlumno, setFormAlumno] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', grado: '1', grupo: '' });

  const loadAll = async () => {
    if (!escuelaId) return;
    setLoading(true);
    try {
      const [lib, pend, mas, alum, dir] = await Promise.all([
        api('GET', '/director/libros'),
        api('GET', '/director/libros/pendientes'),
        api('GET', `/escuelas/${escuelaId}/maestros`),
        api('GET', `/escuelas/${escuelaId}/alumnos`),
        api('GET', `/escuelas/${escuelaId}/directores`),
      ]);
      setLibros(lib?.data || []);
      setPendientes(pend?.data || []);
      setMaestros(mas?.data || []);
      setAlumnos(alum?.data || []);
      setDirectores(dir?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [escuelaId]);

  const canjearLibro = async (e) => {
    e.preventDefault();
    if (!codigoCanjear.trim()) return;
    setMsg(null);
    try {
      await api('POST', '/director/canjear-libro', { codigo: codigoCanjear.trim() });
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
      const payload = {
        ...formAlumno,
        grado: Number(formAlumno.grado) || 1,
      };
      await api('POST', '/personas/registro-alumno', payload);
      setMsg({ type: 'success', text: 'Alumno registrado' });
      setFormAlumno({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', grado: '1', grupo: '' });
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

      <section className="page-section">
        <h2 className="page-section__title">Canjear libro</h2>
        <p className="card-desc">Introduce el código que el admin te otorgó.</p>
        <div className="card">
          <form onSubmit={canjearLibro} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 200px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Código</span>
              <input value={codigoCanjear} onChange={(e) => setCodigoCanjear(e.target.value)} placeholder="LIB-..." style={{ width: '100%' }} required />
            </label>
            <button type="submit" className="btn btn-primary">Canjear</button>
          </form>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Libros pendientes de canjear</h2>
        <p className="card-desc">Solo ves título y grado. Pide el código al admin.</p>
        <div className="data-table-wrap">
          {pendientes.length === 0 ? (
            <div className="empty-state">Ninguno pendiente.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Título</th><th>Grado</th></tr></thead>
              <tbody>
                {pendientes.map((p, i) => (
                  <tr key={i}><td><strong>{p.titulo}</strong></td><td className="cell-muted">{p.grado}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Libros activos</h2>
        <div className="data-table-wrap">
          {libros.length === 0 ? (
            <div className="empty-state">Ninguno. Canjea un libro arriba.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Título</th><th>Grado</th><th>Código</th></tr></thead>
              <tbody>
                {libros.map((l) => (
                  <tr key={l.id}><td><strong>{l.titulo}</strong></td><td className="cell-muted">{l.grado}</td><td className="cell-muted">{l.codigo ?? '-'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Registrar maestro</h2>
        <p className="card-desc">No necesitas idEscuela; se usa tu escuela.</p>
        <div className="card">
        <form onSubmit={registrarMaestro} className="form-grid">
          {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono', 'especialidad'].map((k) => (
            <label key={k}><span>{k}</span><input value={formMaestro[k]} onChange={(e) => setFormMaestro({ ...formMaestro, [k]: e.target.value })} required={['nombre','apellidoPaterno','apellidoMaterno','email','password'].includes(k)} /></label>
          ))}
          <button type="submit" className="btn btn-primary">Registrar</button>
        </form>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Registrar alumno</h2>
        <p className="card-desc">Se usa tu escuela automáticamente. Sin padre (se vincula después).</p>
        <div className="card">
        <form onSubmit={registrarAlumno} className="form-grid">
          {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono', 'grado', 'grupo'].map((k) => (
            <label key={k}><span>{k}</span><input value={formAlumno[k]} onChange={(e) => setFormAlumno({ ...formAlumno, [k]: e.target.value })} required={['nombre','apellidoPaterno','apellidoMaterno','email','password'].includes(k)} /></label>
          ))}
          <button type="submit" className="btn btn-primary">Registrar</button>
        </form>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Directores de esta escuela</h2>
        <div className="data-table-wrap">
          {directores.length === 0 ? (
            <div className="empty-state">Sin directores registrados.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Nombramiento</th></tr></thead>
              <tbody>
                {directores.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.persona?.nombre} {d.persona?.apellido}</strong></td>
                    <td className="cell-muted">{d.persona?.correo ?? '-'}</td>
                    <td className="cell-muted">{d.persona?.telefono ?? '-'}</td>
                    <td className="cell-muted">{d.fechaNombramiento ? new Date(d.fechaNombramiento).toLocaleDateString('es-MX') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Maestros</h2>
        <div className="data-table-wrap">
          {maestros.length === 0 ? (
            <div className="empty-state">Sin maestros.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Especialidad</th></tr></thead>
              <tbody>
                {maestros.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.persona?.nombre} {m.persona?.apellido}</strong></td>
                    <td className="cell-muted">{m.persona?.correo ?? '-'}</td>
                    <td className="cell-muted">{m.especialidad ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Alumnos</h2>
        <p className="card-desc">Lista de alumnos de tu escuela. Padre/tutor cuando está asignado.</p>
        <div className="data-table-wrap">
          {alumnos.length === 0 ? (
            <div className="empty-state">Sin alumnos.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Grado · Grupo</th><th>Padre / Tutor</th></tr></thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.persona?.nombre} {a.persona?.apellido}</strong></td>
                    <td className="cell-muted">Grado {a.grado}{a.grupo ? ` · ${a.grupo}` : ''}</td>
                    <td className="cell-muted">{a.padre ? `${a.padre.persona?.nombre} ${a.padre.persona?.apellido}` : 'Sin padre asignado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
