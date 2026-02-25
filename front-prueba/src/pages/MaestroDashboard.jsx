import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../api/api';

export default function MaestroDashboard() {
  const [alumnos, setAlumnos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ alumnoId: '', materiaId: '' });

  const loadAlumnos = async () => {
    try {
      const data = await api('GET', '/maestros/mis-alumnos');
      setAlumnos(data?.data ?? data?.alumnos ?? []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  useEffect(() => { loadAlumnos(); }, []);

  const asignarAlumno = async (e) => {
    e.preventDefault();
    if (!form.alumnoId || !form.materiaId) return;
    setMsg(null);
    try {
      await api('POST', '/maestros/asignar-alumno', { alumnoId: Number(form.alumnoId), materiaId: Number(form.materiaId) });
      setMsg({ type: 'success', text: 'Alumno asignado' });
      setForm({ alumnoId: '', materiaId: '' });
      loadAlumnos();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  return (
    <Layout title="Mi clase" badge="maestro" sidebarItems={[]}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="page-section">
        <h2 className="page-section__title">Mis alumnos</h2>
        <button className="btn btn-sm btn-primary" style={{ marginBottom: '1rem' }} onClick={loadAlumnos}>Actualizar</button>
        {alumnos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Sin alumnos asignados. Asigna alumnos por materia abajo.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Materia</th></tr></thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.persona?.nombre} {a.persona?.apellido}</strong></td>
                    <td className="cell-muted">{a.materiaAsignada?.nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Asignar alumno a mi clase (por materia)</h2>
        <div className="card">
          <form onSubmit={asignarAlumno} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 400 }}>
            <label><span>Alumno</span>
              <select value={form.alumnoId} onChange={(e) => setForm({ ...form, alumnoId: e.target.value })} required>
                <option value="">Seleccionar</option>
                {alumnos.map((a) => (
                  <option key={a.id} value={a.id}>{a.persona?.nombre} {a.persona?.apellido}</option>
                ))}
              </select>
            </label>
            <label><span>ID Materia</span><input type="number" value={form.materiaId} onChange={(e) => setForm({ ...form, materiaId: e.target.value })} placeholder="1" required /></label>
            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>Asignar alumno</button>
          </form>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Asignar libro a alumno</h2>
        <p className="card-desc">El alumno debe estar en tu clase o ser de tu escuela. Solo verás libros que coincidan con su grado.</p>
        <AsignarLibroMaestro alumnos={alumnos} loadAlumnos={loadAlumnos} setMsg={setMsg} />
      </section>
    </Layout>
  );
}

function AsignarLibroMaestro({ alumnos, loadAlumnos, setMsg }) {
  const [alumnoId, setAlumnoId] = useState('');
  const [libroId, setLibroId] = useState('');
  const [librosDisponibles, setLibrosDisponibles] = useState([]);
  const [loadingLibros, setLoadingLibros] = useState(false);
  const [asignando, setAsignando] = useState(false);

  useEffect(() => {
    if (!alumnoId) {
      setLibrosDisponibles([]);
      setLibroId('');
      return;
    }
    setLoadingLibros(true);
    api('GET', `/maestros/libros-disponibles-para-asignar?alumnoId=${alumnoId}`)
      .then((r) => setLibrosDisponibles(r?.data ?? []))
      .catch((e) => setMsg({ type: 'error', text: e?.data?.message || e?.message }))
      .finally(() => setLoadingLibros(false));
  }, [alumnoId]);

  const asignar = async (e) => {
    e.preventDefault();
    if (!alumnoId || !libroId) return;
    setMsg(null);
    setAsignando(true);
    try {
      await api('POST', '/maestros/asignar-libro', { alumnoId: Number(alumnoId), libroId: Number(libroId) });
      setMsg({ type: 'success', text: 'Libro asignado correctamente' });
      setAlumnoId('');
      setLibroId('');
      setLibrosDisponibles([]);
      loadAlumnos?.();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setAsignando(false);
    }
  };

  const alumnosParaLibros = alumnos.filter((a) => a.escuelaId || a.escuela?.id);
  const listaAlumnos = alumnosParaLibros.length ? alumnosParaLibros : alumnos;

  return (
    <div className="card">
      <form onSubmit={asignar} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 500 }}>
        <label>
          <span>Alumno</span>
          <select value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)} required>
            <option value="">Seleccionar</option>
            {listaAlumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.persona?.nombre} {a.persona?.apellido} — Grado {a.grado ?? '?'}{a.grupo ? ` ${a.grupo}` : ''}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Libro</span>
          <select
            value={libroId}
            onChange={(e) => setLibroId(e.target.value)}
            required
            disabled={loadingLibros || !alumnoId}
          >
            <option value="">{loadingLibros ? 'Cargando...' : !alumnoId ? 'Elige alumno primero' : 'Seleccionar'}</option>
            {librosDisponibles.map((l) => (
              <option key={l.id} value={l.id}>{l.titulo} (Grado {l.grado})</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={asignando || !alumnoId || !libroId} style={{ gridColumn: '1 / -1' }}>
          {asignando ? 'Asignando...' : 'Asignar libro'}
        </button>
      </form>
    </div>
  );
}
