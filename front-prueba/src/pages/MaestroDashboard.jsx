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

      <div className="card">
        <h3>Mis alumnos</h3>
        <button className="btn btn-sm btn-primary" style={{ marginBottom: '1rem' }} onClick={loadAlumnos}>Actualizar</button>
        {alumnos.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Sin alumnos asignados.</p> : (
          alumnos.map((a) => (
            <div key={a.id} className="list-item">
              <div>
                <h4>{a.persona?.nombre} {a.persona?.apellido}</h4>
                <span className="meta">{a.materiaAsignada?.nombre || '—'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Asignar alumno a mi clase</h3>
        <form onSubmit={asignarAlumno} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <label><span>ID Alumno</span><input type="number" value={form.alumnoId} onChange={(e) => setForm({ ...form, alumnoId: e.target.value })} required /></label>
          <label><span>ID Materia</span><input type="number" value={form.materiaId} onChange={(e) => setForm({ ...form, materiaId: e.target.value })} required /></label>
        </form>
        <button type="submit" className="btn btn-primary">Asignar</button>
      </div>
    </Layout>
  );
}
