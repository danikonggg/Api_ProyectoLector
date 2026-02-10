import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';

/**
 * Página pública de pruebas. Sin login.
 * Solo registro alumno y registro padre usando los endpoints de prueba (sin token).
 */
export default function Pruebas() {
  const [tab, setTab] = useState('alumno');
  const [escuelas, setEscuelas] = useState([]);
  const [msg, setMsg] = useState(null);

  const loadEscuelas = async () => {
    try {
      const res = await api('GET', '/escuelas/lista');
      setEscuelas(res?.data || res || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadEscuelas();
  }, []);
  const [formAlumno, setFormAlumno] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    password: '',
    telefono: '',
    fechaNacimiento: '',
    idEscuela: '',
    grado: '1',
    grupo: '',
    cicloEscolar: '',
  });
  const [formPadre, setFormPadre] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    password: '',
    telefono: '',
    fechaNacimiento: '',
    alumnoId: '',
  });

  const registrarAlumno = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const payload = {
        nombre: formAlumno.nombre,
        apellidoPaterno: formAlumno.apellidoPaterno,
        apellidoMaterno: formAlumno.apellidoMaterno || formAlumno.apellidoPaterno,
        email: formAlumno.email,
        password: formAlumno.password,
        telefono: formAlumno.telefono || undefined,
        fechaNacimiento: formAlumno.fechaNacimiento || undefined,
        idEscuela: Number(formAlumno.idEscuela),
        grado: Number(formAlumno.grado) || 1,
        grupo: formAlumno.grupo || undefined,
        cicloEscolar: formAlumno.cicloEscolar || undefined,
      };
      await api('POST', '/personas/registro-alumno-prueba', payload);
      setMsg({ type: 'success', text: 'Alumno registrado correctamente' });
      setFormAlumno({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', fechaNacimiento: '', idEscuela: '', grado: '1', grupo: '', cicloEscolar: '' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const registrarPadre = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const payload = {
        nombre: formPadre.nombre,
        apellidoPaterno: formPadre.apellidoPaterno,
        apellidoMaterno: formPadre.apellidoMaterno || formPadre.apellidoPaterno,
        email: formPadre.email,
        password: formPadre.password,
        telefono: formPadre.telefono || undefined,
        fechaNacimiento: formPadre.fechaNacimiento || undefined,
        alumnoId: formPadre.alumnoId ? Number(formPadre.alumnoId) : undefined,
      };
      await api('POST', '/personas/registro-padre-prueba', payload);
      setMsg({ type: 'success', text: 'Padre registrado correctamente' + (formPadre.alumnoId ? '. Vinculado al alumno.' : '') });
      setFormPadre({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', fechaNacimiento: '', alumnoId: '' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', background: 'linear-gradient(135deg, var(--bg) 0%, #1a1a20 100%)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem' }}>🧪 Pruebas de registro</h1>
          <Link to="/login" className="btn btn-ghost btn-sm">Ir a login</Link>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Endpoints públicos para probar. No requiere token.
        </p>

        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div className="card">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${tab === 'alumno' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('alumno')}
            >
              Registro alumno
            </button>
            <button
              className={`btn ${tab === 'padre' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('padre')}
            >
              Registro padre
            </button>
          </div>

          {tab === 'alumno' && (
            <form onSubmit={registrarAlumno} className="form-grid">
              <h3 style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>Registro solo alumno</h3>
              <p className="card-desc" style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                Sin padre. Usa POST /personas/registro-alumno-prueba
              </p>
              <label><span>Nombre</span><input value={formAlumno.nombre} onChange={(e) => setFormAlumno({ ...formAlumno, nombre: e.target.value })} required /></label>
              <label><span>Apellido paterno</span><input value={formAlumno.apellidoPaterno} onChange={(e) => setFormAlumno({ ...formAlumno, apellidoPaterno: e.target.value })} required /></label>
              <label><span>Apellido materno</span><input value={formAlumno.apellidoMaterno} onChange={(e) => setFormAlumno({ ...formAlumno, apellidoMaterno: e.target.value })} /></label>
              <label><span>Email</span><input type="email" value={formAlumno.email} onChange={(e) => setFormAlumno({ ...formAlumno, email: e.target.value })} required /></label>
              <label><span>Contraseña (mín. 6)</span><input type="password" value={formAlumno.password} onChange={(e) => setFormAlumno({ ...formAlumno, password: e.target.value })} minLength={6} required /></label>
              <label><span>Teléfono</span><input value={formAlumno.telefono} onChange={(e) => setFormAlumno({ ...formAlumno, telefono: e.target.value })} /></label>
              <label><span>Fecha nacimiento (opcional)</span><input type="date" value={formAlumno.fechaNacimiento} onChange={(e) => setFormAlumno({ ...formAlumno, fechaNacimiento: e.target.value })} /></label>
              <label>
                <span>Escuela</span>
                <select value={formAlumno.idEscuela} onChange={(e) => setFormAlumno({ ...formAlumno, idEscuela: e.target.value })} required>
                  <option value="">Seleccionar</option>
                  {escuelas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre} (ID {e.id})</option>
                  ))}
                </select>
              </label>
              <label><span>Grado</span><input type="number" value={formAlumno.grado} onChange={(e) => setFormAlumno({ ...formAlumno, grado: e.target.value })} min={1} /></label>
              <label><span>Grupo</span><input value={formAlumno.grupo} onChange={(e) => setFormAlumno({ ...formAlumno, grupo: e.target.value })} placeholder="A" /></label>
              <label><span>Ciclo escolar (opcional)</span><input value={formAlumno.cicloEscolar} onChange={(e) => setFormAlumno({ ...formAlumno, cicloEscolar: e.target.value })} placeholder="2024-2025" /></label>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>Registrar alumno</button>
            </form>
          )}

          {tab === 'padre' && (
            <form onSubmit={registrarPadre} className="form-grid">
              <h3 style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>Registro padre</h3>
              <p className="card-desc" style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                Opcional: alumnoId para vincular y que el padre vea sus avances. Usa POST /personas/registro-padre-prueba
              </p>
              <label><span>Nombre</span><input value={formPadre.nombre} onChange={(e) => setFormPadre({ ...formPadre, nombre: e.target.value })} required /></label>
              <label><span>Apellido paterno</span><input value={formPadre.apellidoPaterno} onChange={(e) => setFormPadre({ ...formPadre, apellidoPaterno: e.target.value })} required /></label>
              <label><span>Apellido materno</span><input value={formPadre.apellidoMaterno} onChange={(e) => setFormPadre({ ...formPadre, apellidoMaterno: e.target.value })} /></label>
              <label><span>Email</span><input type="email" value={formPadre.email} onChange={(e) => setFormPadre({ ...formPadre, email: e.target.value })} required /></label>
              <label><span>Contraseña (mín. 6)</span><input type="password" value={formPadre.password} onChange={(e) => setFormPadre({ ...formPadre, password: e.target.value })} minLength={6} required /></label>
              <label><span>Teléfono</span><input value={formPadre.telefono} onChange={(e) => setFormPadre({ ...formPadre, telefono: e.target.value })} /></label>
              <label><span>Fecha nacimiento (opcional)</span><input type="date" value={formPadre.fechaNacimiento} onChange={(e) => setFormPadre({ ...formPadre, fechaNacimiento: e.target.value })} /></label>
              <label>
                <span>ID alumno (opcional)</span>
                <input type="number" value={formPadre.alumnoId} onChange={(e) => setFormPadre({ ...formPadre, alumnoId: e.target.value })} placeholder="Para vincular y ver avances" min={1} />
              </label>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>Registrar padre</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
