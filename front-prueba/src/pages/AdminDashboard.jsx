import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api, getBaseUrl, getToken } from '../api/api';

const SIDEBAR_ITEMS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/escuelas', label: 'Escuelas' },
  { to: '/admin/libros', label: 'Libros' },
  { to: '/admin/usuarios', label: 'Usuarios' },
];

export default function AdminDashboard() {
  const [view, setView] = useState(null);
  return (
    <Layout
      title="Panel Admin"
      badge="admin"
      sidebarItems={[
        { label: 'Inicio', onClick: () => setView(null), active: !view },
        { label: 'Escuelas', onClick: () => setView('escuelas'), active: view === 'escuelas' },
        { label: 'Libros', onClick: () => setView('libros'), active: view === 'libros' },
        { label: 'Usuarios', onClick: () => setView('usuarios'), active: view === 'usuarios' },
      ]}
    >
      {view === 'escuelas' && <AdminEscuelas />}
      {view === 'libros' && <AdminLibros />}
      {view === 'usuarios' && <AdminUsuarios />}
      {!view && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <CardButton title="Escuelas" desc="Gestionar escuelas y otorgar libros" onClick={() => setView('escuelas')} />
          <CardButton title="Libros" desc="Cargar PDFs y ver catálogo" onClick={() => setView('libros')} />
          <CardButton title="Usuarios" desc="Registrar directores y maestros" onClick={() => setView('usuarios')} />
        </div>
      )}
    </Layout>
  );
}

function CardButton({ title, desc, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{ minWidth: 200, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
      <h3>{title}</h3>
      {desc && <p className="card-desc" style={{ marginBottom: 0 }}>{desc}</p>}
    </button>
  );
}

function AdminEscuelas() {
  const [escuelas, setEscuelas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ nombre: '', nivel: '', clave: '', direccion: '', telefono: '' });
  const [otorgarForm, setOtorgarForm] = useState({ escuelaId: '', codigo: '' });
  const [librosEscuela, setLibrosEscuela] = useState(null);
  const [pendientes, setPendientes] = useState(null);

  const loadEscuelas = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api('GET', '/escuelas');
      setEscuelas(data?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  const crearEscuela = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api('POST', '/escuelas', form);
      setMsg({ type: 'success', text: 'Escuela creada' });
      setForm({ nombre: '', nivel: '', clave: '', direccion: '', telefono: '' });
      loadEscuelas();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const otorgarLibro = async (e) => {
    e.preventDefault();
    if (!otorgarForm.escuelaId || !otorgarForm.codigo) {
      setMsg({ type: 'error', text: 'Indica escuela y código' });
      return;
    }
    setMsg(null);
    try {
      await api('POST', `/escuelas/${otorgarForm.escuelaId}/libros`, { codigo: otorgarForm.codigo });
      setMsg({ type: 'success', text: 'Libro otorgado' });
      setOtorgarForm({ escuelaId: '', codigo: '' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const verLibros = async (id) => {
    try {
      const [libros, pend] = await Promise.all([
        api('GET', `/escuelas/${id}/libros`),
        api('GET', `/escuelas/${id}/libros/pendientes`),
      ]);
      setLibrosEscuela({ id, activos: libros?.data || [], pendientes: pend?.data || [] });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  return (
    <>
      <div className="section-title">
        <span>Escuelas</span>
        <button className="btn btn-primary btn-sm" onClick={loadEscuelas} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3>Crear escuela</h3>
        <form onSubmit={crearEscuela} className="form-grid">
          <label><span>Nombre</span><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
          <label><span>Nivel</span><input value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} placeholder="Primaria" required /></label>
          <label><span>Clave</span><input value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} /></label>
          <label><span>Dirección</span><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></label>
          <label><span>Teléfono</span><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
        </form>
        <button type="submit" className="btn btn-primary" onClick={crearEscuela}>Crear</button>
      </div>

      <div className="card">
        <h3>Otorgar libro a escuela (Paso 1)</h3>
        <p className="card-desc">Admin otorga. La escuela debe canjear después.</p>
        <form onSubmit={otorgarLibro} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <label><span>ID Escuela</span><input type="number" value={otorgarForm.escuelaId} onChange={(e) => setOtorgarForm({ ...otorgarForm, escuelaId: e.target.value })} required /></label>
          <label><span>Código libro</span><input value={otorgarForm.codigo} onChange={(e) => setOtorgarForm({ ...otorgarForm, codigo: e.target.value })} required /></label>
        </form>
        <button type="submit" className="btn btn-primary">Otorgar</button>
      </div>

      <div className="card">
        <h3>Lista de escuelas</h3>
        {escuelas.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Sin escuelas. Carga la lista.</p> : (
          <div>
            {escuelas.map((e) => (
              <div key={e.id} className="list-item">
                <div>
                  <h4>{e.nombre}</h4>
                  <span className="meta">{e.nivel} · ID {e.id}</span>
                </div>
                <div className="actions">
                  <button className="btn btn-sm btn-primary" onClick={() => verLibros(e.id)}>Libros</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {librosEscuela && (
        <div className="card">
          <h3>Libros escuela ID {librosEscuela.id}</h3>
          <p><strong>Activos:</strong> {librosEscuela.activos.length}</p>
          <p><strong>Pendientes de canjear:</strong> {librosEscuela.pendientes.length}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setLibrosEscuela(null)}>Cerrar</button>
        </div>
      )}
    </>
  );
}

function AdminLibros() {
  const [libros, setLibros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cargarForm, setCargarForm] = useState({ titulo: '', grado: '', descripcion: '', codigo: '' });
  const [pdfFile, setPdfFile] = useState(null);

  const loadLibros = async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/libros');
      setLibros(data?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  const cargarLibro = async (e) => {
    e.preventDefault();
    if (!pdfFile) {
      setMsg({ type: 'error', text: 'Selecciona un PDF' });
      return;
    }
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('pdf', pdfFile);
      fd.append('titulo', cargarForm.titulo);
      fd.append('grado', Number(cargarForm.grado) || 1);
      if (cargarForm.descripcion) fd.append('descripcion', cargarForm.descripcion);
      if (cargarForm.codigo) fd.append('codigo', cargarForm.codigo);
      const res = await fetch(`${getBaseUrl()}/libros/cargar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw { data };
      setMsg({ type: 'success', text: 'Libro cargado' });
      setCargarForm({ titulo: '', grado: '', descripcion: '', codigo: '' });
      setPdfFile(null);
      loadLibros();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message || 'Error' });
    }
  };

  const descargarPdf = async (id) => {
    try {
      const res = await fetch(`${getBaseUrl()}/libros/${id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `libro-${id}.pdf`;
      a.click();
    } catch (e) {
      setMsg({ type: 'error', text: e?.message });
    }
  };

  return (
    <>
      <div className="section-title">
        <span>Libros</span>
        <button className="btn btn-primary btn-sm" onClick={loadLibros} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3>Cargar libro (PDF)</h3>
        <form onSubmit={cargarLibro} className="form-grid">
          <label><span>PDF</span><input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0])} required /></label>
          <label><span>Título</span><input value={cargarForm.titulo} onChange={(e) => setCargarForm({ ...cargarForm, titulo: e.target.value })} required /></label>
          <label><span>Grado</span><input type="number" value={cargarForm.grado} onChange={(e) => setCargarForm({ ...cargarForm, grado: e.target.value })} required /></label>
          <label><span>Descripción</span><input value={cargarForm.descripcion} onChange={(e) => setCargarForm({ ...cargarForm, descripcion: e.target.value })} /></label>
          <label><span>Código</span><input value={cargarForm.codigo} onChange={(e) => setCargarForm({ ...cargarForm, codigo: e.target.value })} placeholder="opcional" /></label>
        </form>
        <button type="submit" className="btn btn-primary">Cargar</button>
      </div>

      <div className="card">
        <h3>Catálogo</h3>
        {libros.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Sin libros.</p> : (
          libros.map((l) => (
            <div key={l.id} className="list-item">
              <div>
                <h4>{l.titulo}</h4>
                <span className="meta">Grado {l.grado} · {l.codigo}</span>
              </div>
              <div className="actions">
                <button className="btn btn-sm btn-primary" onClick={() => descargarPdf(l.id)}>PDF</button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function AdminUsuarios() {
  const [escuelas, setEscuelas] = useState([]);
  const [msg, setMsg] = useState(null);
  const [formDir, setFormDir] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', telefono: '' });
  const [formMas, setFormMas] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', telefono: '', especialidad: '' });

  const loadEscuelas = async () => {
    const data = await api('GET', '/escuelas');
    setEscuelas(data?.data || []);
  };

  useEffect(() => { loadEscuelas(); }, []);

  const registroDirector = async (e) => {
    e.preventDefault();
    try {
      await api('POST', '/personas/registro-director', { ...formDir, idEscuela: Number(formDir.idEscuela) });
      setMsg({ type: 'success', text: 'Director registrado' });
      setFormDir({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', telefono: '' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const registroMaestro = async (e) => {
    e.preventDefault();
    try {
      await api('POST', '/personas/registro-maestro', { ...formMas, idEscuela: Number(formMas.idEscuela) });
      setMsg({ type: 'success', text: 'Maestro registrado' });
      setFormMas({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', telefono: '', especialidad: '' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  return (
    <>
      <div className="section-title"><span>Registro de usuarios</span><button className="btn btn-sm btn-ghost" onClick={loadEscuelas}>Cargar escuelas</button></div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3>Registrar director</h3>
        <form onSubmit={registroDirector} className="form-grid">
          <label><span>Nombre</span><input value={formDir.nombre} onChange={(e) => setFormDir({ ...formDir, nombre: e.target.value })} required /></label>
          <label><span>Ap. Paterno</span><input value={formDir.apellidoPaterno} onChange={(e) => setFormDir({ ...formDir, apellidoPaterno: e.target.value })} required /></label>
          <label><span>Ap. Materno</span><input value={formDir.apellidoMaterno} onChange={(e) => setFormDir({ ...formDir, apellidoMaterno: e.target.value })} required /></label>
          <label><span>Email</span><input type="email" value={formDir.email} onChange={(e) => setFormDir({ ...formDir, email: e.target.value })} required /></label>
          <label><span>Password</span><input type="password" value={formDir.password} onChange={(e) => setFormDir({ ...formDir, password: e.target.value })} required /></label>
          <label><span>ID Escuela</span><select value={formDir.idEscuela} onChange={(e) => setFormDir({ ...formDir, idEscuela: e.target.value })} required>
            <option value="">Seleccionar</option>
            {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select></label>
        </form>
        <button type="submit" className="btn btn-primary">Registrar</button>
      </div>

      <div className="card">
        <h3>Registrar maestro</h3>
        <form onSubmit={registroMaestro} className="form-grid">
          <label><span>Nombre</span><input value={formMas.nombre} onChange={(e) => setFormMas({ ...formMas, nombre: e.target.value })} required /></label>
          <label><span>Ap. Paterno</span><input value={formMas.apellidoPaterno} onChange={(e) => setFormMas({ ...formMas, apellidoPaterno: e.target.value })} required /></label>
          <label><span>Ap. Materno</span><input value={formMas.apellidoMaterno} onChange={(e) => setFormMas({ ...formMas, apellidoMaterno: e.target.value })} required /></label>
          <label><span>Email</span><input type="email" value={formMas.email} onChange={(e) => setFormMas({ ...formMas, email: e.target.value })} required /></label>
          <label><span>Password</span><input type="password" value={formMas.password} onChange={(e) => setFormMas({ ...formMas, password: e.target.value })} required /></label>
          <label><span>ID Escuela</span><select value={formMas.idEscuela} onChange={(e) => setFormMas({ ...formMas, idEscuela: e.target.value })} required>
            <option value="">Seleccionar</option>
            {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select></label>
          <label><span>Especialidad</span><input value={formMas.especialidad} onChange={(e) => setFormMas({ ...formMas, especialidad: e.target.value })} /></label>
        </form>
        <button type="submit" className="btn btn-primary">Registrar</button>
      </div>
    </>
  );
}
