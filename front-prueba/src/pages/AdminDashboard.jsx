import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { api, apiUpload, getBaseUrl, getToken } from '../api/api';

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
        { label: 'Alumnos y Padres', onClick: () => setView('alumnos-padres'), active: view === 'alumnos-padres' },
        { label: 'Auditoría', onClick: () => setView('auditoria'), active: view === 'auditoria' },
      ]}
    >
      {view === 'escuelas' && <AdminEscuelas />}
      {view === 'libros' && <AdminLibros />}
      {view === 'usuarios' && <AdminUsuarios />}
      {view === 'alumnos-padres' && <AdminAlumnosPadres />}
      {view === 'auditoria' && <AdminAuditoria />}
      {!view && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <CardButton title="Escuelas" desc="Gestionar escuelas y otorgar libros" onClick={() => setView('escuelas')} />
          <CardButton title="Libros" desc="Cargar PDFs y ver catálogo" onClick={() => setView('libros')} />
          <CardButton title="Usuarios" desc="Registrar directores y maestros" onClick={() => setView('usuarios')} />
          <CardButton title="Alumnos y Padres" desc="Ver alumnos, padres y sus relaciones" onClick={() => setView('alumnos-padres')} />
          <CardButton title="Auditoría" desc="Logs de acciones sensibles" onClick={() => setView('auditoria')} />
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

function AdminAuditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadLogs = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api('GET', `/audit?page=${page}&limit=${limit}`);
      setLogs(data?.data || []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.meta?.totalPages ?? 1);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message || 'Error al cargar auditoría' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page]);

  const formatFecha = (f) => {
    if (!f) return '-';
    const d = new Date(f);
    return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
  };

  const accionLabel = (a) => {
    const map = {
      login: 'Login',
      login_fallido: 'Login fallido',
      registro_admin: 'Registro admin',
      registro_padre: 'Registro padre',
      registro_alumno: 'Registro alumno',
      registro_maestro: 'Registro maestro',
      registro_director: 'Registro director',
      escuela_crear: 'Crear escuela',
      escuela_actualizar: 'Actualizar escuela',
      escuela_eliminar: 'Eliminar escuela',
      libro_cargar: 'Cargar libro',
      libro_eliminar: 'Eliminar libro',
      libro_canjear: 'Canjear libro (escuela)',
    };
    return map[a] || a;
  };

  return (
    <>
      <div className="section-title">
        <span>Auditoría</span>
        <button className="btn btn-primary btn-sm" onClick={loadLogs} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3>Logs de auditoría</h3>
        <p className="card-desc" style={{ marginBottom: '1rem' }}>
          Registro de acciones sensibles: logins, registros, creación/edición de escuelas y libros.
        </p>
        {logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Sin registros.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Fecha</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Acción</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Usuario ID</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>IP</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{formatFecha(l.fecha)}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span className="badge badge-admin" style={{ fontSize: '0.75rem' }}>{accionLabel(l.accion)}</span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{l.usuarioId ?? '-'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.ip ?? '-'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.detalles}>{l.detalles ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Anterior
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Página {page} de {totalPages} ({total} registros)
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
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

function formatApiError(e) {
  if (!e) return 'Error desconocido';
  const msg = e?.data?.message ?? e?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  if (typeof msg === 'string' && msg.length < 500) return msg;
  if (e?.message) return e.message;
  return 'Error de conexión. Verifica que la API esté corriendo.';
}

function AdminLibros() {
  const [libros, setLibros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cargarForm, setCargarForm] = useState({ titulo: '', grado: '', descripcion: '', codigo: '' });
  const [pdfFile, setPdfFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadLibros = async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/libros');
      setLibros(data?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: formatApiError(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibros();
  }, []);

  const cargarLibro = async (e) => {
    e.preventDefault();
    if (!pdfFile) {
      setMsg({ type: 'error', text: 'Selecciona un PDF' });
      return;
    }
    if (!cargarForm.titulo?.trim()) {
      setMsg({ type: 'error', text: 'El título es obligatorio' });
      return;
    }
    setMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('pdf', pdfFile);
      fd.append('titulo', cargarForm.titulo.trim());
      fd.append('grado', String(Number(cargarForm.grado) || 1));
      if (cargarForm.descripcion?.trim()) fd.append('descripcion', cargarForm.descripcion.trim());
      if (cargarForm.codigo?.trim()) fd.append('codigo', cargarForm.codigo.trim());
      await apiUpload('/libros/cargar', fd);
      setMsg({ type: 'success', text: 'Libro cargado correctamente' });
      setCargarForm({ titulo: '', grado: '', descripcion: '', codigo: '' });
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadLibros();
    } catch (e) {
      let text = formatApiError(e) || e?.message || 'Error desconocido';
      if (text.includes('fetch') || text.includes('Failed') || text.includes('NetworkError')) {
        const base = getBaseUrl();
        text = `Error de conexión. Verifica: 1) API en ${base} 2) Si usas :5173, la URL debe ser ${window.location.origin} para el proxy`;
      }
      setMsg({ type: 'error', text });
    } finally {
      setUploading(false);
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
          <label><span>PDF</span><input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0])} required disabled={uploading} /></label>
          <label><span>Título</span><input value={cargarForm.titulo} onChange={(e) => setCargarForm({ ...cargarForm, titulo: e.target.value })} required /></label>
          <label><span>Grado</span><input type="number" value={cargarForm.grado} onChange={(e) => setCargarForm({ ...cargarForm, grado: e.target.value })} required /></label>
          <label><span>Descripción</span><input value={cargarForm.descripcion} onChange={(e) => setCargarForm({ ...cargarForm, descripcion: e.target.value })} /></label>
          <label><span>Código</span><input value={cargarForm.codigo} onChange={(e) => setCargarForm({ ...cargarForm, codigo: e.target.value })} placeholder="opcional" /></label>
        </form>
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Cargando PDF... (puede tardar)' : 'Cargar'}
        </button>
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

function AdminAlumnosPadres() {
  const [tab, setTab] = useState('alumnos');
  const [escuelas, setEscuelas] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [padres, setPadres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [filtroEscuela, setFiltroEscuela] = useState('');
  const [detalleAlumno, setDetalleAlumno] = useState(null);
  const [detallePadre, setDetallePadre] = useState(null);

  const loadEscuelas = async () => {
    const data = await api('GET', '/escuelas');
    setEscuelas(data?.data || []);
  };

  const loadAlumnos = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const path = filtroEscuela ? `/personas/alumnos?escuelaId=${filtroEscuela}` : '/personas/alumnos';
      const data = await api('GET', path);
      setAlumnos(data?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  const loadPadres = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api('GET', '/personas/padres');
      setPadres(data?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  const verAlumno = async (id) => {
    try {
      const data = await api('GET', `/personas/alumnos/${id}`);
      setDetalleAlumno(data?.data);
      setDetallePadre(null);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const verPadre = async (id) => {
    try {
      const data = await api('GET', `/personas/padres/${id}`);
      setDetallePadre(data?.data);
      setDetalleAlumno(null);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  useEffect(() => {
    loadEscuelas();
  }, []);

  useEffect(() => {
    if (tab === 'alumnos') loadAlumnos();
    else loadPadres();
  }, [tab, filtroEscuela]);

  return (
    <>
      <div className="section-title">
        <span>Alumnos y Padres</span>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            className={`btn ${tab === 'alumnos' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('alumnos')}
          >
            Alumnos
          </button>
          <button
            className={`btn ${tab === 'padres' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('padres')}
          >
            Padres / Tutores
          </button>
        </div>

        {tab === 'alumnos' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar por escuela:</span>
                <select
                  value={filtroEscuela}
                  onChange={(e) => setFiltroEscuela(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', minWidth: 200 }}
                >
                  <option value="">Todas</option>
                  {escuelas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary btn-sm" onClick={loadAlumnos} disabled={loading}>
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
            <p className="card-desc" style={{ marginBottom: '1rem' }}>
              Lista de alumnos. Si tiene padre asignado se muestra junto al nombre. Haz clic en Ver para más detalles.
            </p>
            {alumnos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Sin alumnos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alumnos.map((a) => (
                  <div key={a.id} className="list-item">
                    <div>
                      <h4>{a.persona?.nombre} {a.persona?.apellido}</h4>
                      <span className="meta">
                        Grado {a.grado} · {a.escuela?.nombre || `Escuela ID ${a.escuelaId}`}
                        {a.padre && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--accent)' }}>
                            · Padre: {a.padre.persona?.nombre} {a.padre.persona?.apellido}
                          </span>
                        )}
                        {!a.padre && a.padreId === null && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                            · Sin padre asignado
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="actions">
                      <button className="btn btn-sm btn-primary" onClick={() => verAlumno(a.id)}>
                        Ver detalle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'padres' && (
          <>
            <button className="btn btn-primary btn-sm" onClick={loadPadres} disabled={loading} style={{ marginBottom: '1rem' }}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
            <p className="card-desc" style={{ marginBottom: '1rem' }}>
              Lista de padres/tutores con sus hijos.
            </p>
            {padres.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Sin padres registrados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {padres.map((p) => (
                  <div key={p.id} className="list-item">
                    <div>
                      <h4>{p.persona?.nombre} {p.persona?.apellido}</h4>
                      <span className="meta">
                        {p.persona?.correo}
                        {p.cantidadHijos !== undefined && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--accent)' }}>
                            · {p.cantidadHijos} hijo(s)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => verPadre(p.id)}>
                        Ver hijos
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {detalleAlumno && (
        <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: '1px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3>Detalle del alumno</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setDetalleAlumno(null)}>Cerrar</button>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Nombre</strong>
              <p>{detalleAlumno.persona?.nombre} {detalleAlumno.persona?.apellido}</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Email</strong>
              <p>{detalleAlumno.persona?.correo}</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Grado · Grupo</strong>
              <p>{detalleAlumno.grado} · {detalleAlumno.grupo || '-'}</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Escuela</strong>
              <p>{detalleAlumno.escuela?.nombre || `ID ${detalleAlumno.escuelaId}`}</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Padre / Tutor</strong>
              {detalleAlumno.padre ? (
                <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}>
                  <p style={{ marginBottom: '0.25rem' }}>{detalleAlumno.padre.persona?.nombre} {detalleAlumno.padre.persona?.apellido}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{detalleAlumno.padre.persona?.correo}</p>
                  {detalleAlumno.padre.parentesco && (
                    <span className="badge badge-admin" style={{ marginTop: '0.25rem', display: 'inline-block' }}>{detalleAlumno.padre.parentesco}</span>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>Sin padre asignado</p>
              )}
            </div>
          </div>
        </div>
      )}

      {detallePadre && (
        <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: '1px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3>Padre / Tutor y sus hijos</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setDetallePadre(null)}>Cerrar</button>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Padre</strong>
            <p>{detallePadre.persona?.nombre} {detallePadre.persona?.apellido}</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{detallePadre.persona?.correo}</p>
          </div>
          <div>
            <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Hijos ({detallePadre.alumnos?.length || 0})</strong>
            {(!detallePadre.alumnos || detallePadre.alumnos.length === 0) ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Sin hijos registrados.</p>
            ) : (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {detallePadre.alumnos.map((a) => (
                  <div key={a.id} className="list-item" style={{ padding: '0.75rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem' }}>{a.persona?.nombre} {a.persona?.apellido}</h4>
                      <span className="meta">Grado {a.grado} · {a.escuela?.nombre || `Escuela ID ${a.escuelaId}`}</span>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => { setDetallePadre(null); verAlumno(a.id); }}>
                      Ver alumno
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AdminUsuarios() {
  const [escuelas, setEscuelas] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [formPadre, setFormPadre] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', alumnoId: '' });
  const [formDir, setFormDir] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', telefono: '' });
  const [formAlumno, setFormAlumno] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', grado: '1', grupo: '', telefono: '', fechaNacimiento: '', cicloEscolar: '' });
  const [formMas, setFormMas] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', telefono: '', especialidad: '' });
  const [formAdmin, setFormAdmin] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', fechaNacimiento: '' });
  const [modoRegistro, setModoRegistro] = useState('alumno');
  const [cantidadAdmins, setCantidadAdmins] = useState(null);

  const loadEscuelas = async () => {
    const data = await api('GET', '/escuelas');
    setEscuelas(data?.data || []);
  };

  const loadAlumnos = async () => {
    try {
      const data = await api('GET', '/personas/alumnos');
      setAlumnos(data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCantidadAdmins = async () => {
    try {
      const data = await api('GET', '/personas/admins/cantidad');
      setCantidadAdmins(data);
    } catch (e) {
      setCantidadAdmins(null);
    }
  };

  useEffect(() => { loadEscuelas(); loadAlumnos(); loadCantidadAdmins(); }, []);

  const registroPadre = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const payload = {
        ...formPadre,
        apellidoMaterno: formPadre.apellidoMaterno || formPadre.apellidoPaterno,
      };
      if (formPadre.alumnoId) payload.alumnoId = Number(formPadre.alumnoId);
      await api('POST', '/personas/registro-padre', payload);
      setMsg({ type: 'success', text: formPadre.alumnoId ? 'Padre registrado y vinculado al alumno' : 'Padre registrado' });
      setFormPadre({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', alumnoId: '' });
      loadAlumnos();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const registroAlumno = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const payload = {
        nombre: formAlumno.nombre,
        apellidoPaterno: formAlumno.apellidoPaterno,
        apellidoMaterno: formAlumno.apellidoMaterno || formAlumno.apellidoPaterno,
        email: formAlumno.email,
        password: formAlumno.password,
        idEscuela: Number(formAlumno.idEscuela),
        grado: Number(formAlumno.grado) || 1,
        grupo: formAlumno.grupo || undefined,
        telefono: formAlumno.telefono || undefined,
        fechaNacimiento: formAlumno.fechaNacimiento || undefined,
        cicloEscolar: formAlumno.cicloEscolar || undefined,
      };
      await api('POST', '/personas/registro-alumno', payload);
      setMsg({ type: 'success', text: 'Alumno registrado' });
      setFormAlumno({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', idEscuela: '', grado: '1', grupo: '', telefono: '', fechaNacimiento: '', cicloEscolar: '' });
      loadAlumnos();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

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

  const registroAdmin = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api('POST', '/auth/registro-admin', {
        ...formAdmin,
        apellidoMaterno: formAdmin.apellidoMaterno || formAdmin.apellidoPaterno,
      });
      setMsg({ type: 'success', text: 'Administrador registrado' });
      setFormAdmin({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', email: '', password: '', telefono: '', fechaNacimiento: '' });
      loadCantidadAdmins();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  return (
    <>
      <div className="section-title">
        <span>Registro de usuarios</span>
        <button className="btn btn-sm btn-ghost" onClick={() => { loadEscuelas(); loadAlumnos(); }}>Actualizar</button>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {['alumno', 'padre', 'maestro', 'director', 'admin'].map((m) => (
            <button key={m} className={`btn ${modoRegistro === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModoRegistro(m)}>
              {m === 'padre' && 'Padre'}
              {m === 'alumno' && 'Alumno'}
              {m === 'maestro' && 'Maestro'}
              {m === 'director' && 'Director'}
              {m === 'admin' && 'Administrador'}
            </button>
          ))}
        </div>

        {modoRegistro === 'alumno' && (
          <div>
            <h3>Registrar alumno</h3>
            <p className="card-desc">Solo alumno, sin padre. El padre se vincula después con alumnoId.</p>
            <form onSubmit={registroAlumno} className="form-grid">
              {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono', 'grado', 'grupo', 'cicloEscolar'].map((k) => (
                <label key={k}>
                  <span>{k === 'cicloEscolar' ? 'Ciclo escolar' : k}</span>
                  <input
                    type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'}
                    value={formAlumno[k]}
                    onChange={(e) => setFormAlumno({ ...formAlumno, [k]: e.target.value })}
                    required={['nombre', 'apellidoPaterno', 'email', 'password'].includes(k)}
                    placeholder={k === 'cicloEscolar' ? '2024-2025' : ''}
                  />
                </label>
              ))}
              <label><span>Fecha nacimiento</span><input type="date" value={formAlumno.fechaNacimiento} onChange={(e) => setFormAlumno({ ...formAlumno, fechaNacimiento: e.target.value })} /></label>
              <label>
                <span>Escuela</span>
                <select value={formAlumno.idEscuela} onChange={(e) => setFormAlumno({ ...formAlumno, idEscuela: e.target.value })} required>
                  <option value="">Seleccionar</option>
                  {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </label>
              <button type="submit" className="btn btn-primary">Registrar alumno</button>
            </form>
          </div>
        )}

        {modoRegistro === 'padre' && (
          <div>
            <h3>Registrar padre/tutor</h3>
            <p className="card-desc">Opcional: alumnoId para vincular y que el padre vea sus avances.</p>
            <form onSubmit={registroPadre} className="form-grid">
              {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono'].map((k) => (
                <label key={k}><span>{k}</span><input type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'} value={formPadre[k]} onChange={(e) => setFormPadre({ ...formPadre, [k]: e.target.value })} required={['nombre','apellidoPaterno','email','password'].includes(k)} /></label>
              ))}
              <label>
                <span>ID alumno (opcional)</span>
                <select value={formPadre.alumnoId} onChange={(e) => setFormPadre({ ...formPadre, alumnoId: e.target.value })}>
                  <option value="">Sin vincular</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>{a.persona?.nombre} {a.persona?.apellido} (ID {a.id})</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-primary">Registrar padre</button>
            </form>
          </div>
        )}

        {modoRegistro === 'director' && (
          <div>
            <h3>Registrar director</h3>
            <form onSubmit={registroDirector} className="form-grid">
              {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono'].map((k) => (
                <label key={k}><span>{k}</span><input type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'} value={formDir[k]} onChange={(e) => setFormDir({ ...formDir, [k]: e.target.value })} required={['nombre','apellidoPaterno','apellidoMaterno','email','password'].includes(k)} /></label>
              ))}
              <label><span>Escuela</span><select value={formDir.idEscuela} onChange={(e) => setFormDir({ ...formDir, idEscuela: e.target.value })} required>
                <option value="">Seleccionar</option>
                {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select></label>
            </form>
            <button type="submit" className="btn btn-primary">Registrar director</button>
          </div>
        )}

        {modoRegistro === 'admin' && (
          <div>
            <h3>Registrar administrador</h3>
            {cantidadAdmins && (
              <p className="card-desc" style={{ marginBottom: '1rem' }}>
                {cantidadAdmins.mensaje} ({cantidadAdmins.cantidad}/{cantidadAdmins.maxAdmins ?? 5})
              </p>
            )}
            {(cantidadAdmins?.cantidad ?? 0) >= (cantidadAdmins?.maxAdmins ?? 5) ? (
              <p style={{ color: 'var(--text-muted)' }}>No puedes registrar más administradores.</p>
            ) : (
              <form onSubmit={registroAdmin} className="form-grid">
                {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono'].map((k) => (
                  <label key={k}>
                    <span>{k}</span>
                    <input
                      type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'}
                      value={formAdmin[k]}
                      onChange={(e) => setFormAdmin({ ...formAdmin, [k]: e.target.value })}
                      required={['nombre', 'apellidoPaterno', 'email', 'password'].includes(k)}
                    />
                  </label>
                ))}
                <label><span>Fecha nacimiento</span><input type="date" value={formAdmin.fechaNacimiento} onChange={(e) => setFormAdmin({ ...formAdmin, fechaNacimiento: e.target.value })} /></label>
                <button type="submit" className="btn btn-primary">Registrar administrador</button>
              </form>
            )}
          </div>
        )}

        {modoRegistro === 'maestro' && (
          <div>
            <h3>Registrar maestro</h3>
            <form onSubmit={registroMaestro} className="form-grid">
              {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'telefono', 'especialidad'].map((k) => (
                <label key={k}><span>{k}</span><input type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'} value={formMas[k]} onChange={(e) => setFormMas({ ...formMas, [k]: e.target.value })} required={['nombre','apellidoPaterno','apellidoMaterno','email','password'].includes(k)} /></label>
              ))}
              <label><span>Escuela</span><select value={formMas.idEscuela} onChange={(e) => setFormMas({ ...formMas, idEscuela: e.target.value })} required>
                <option value="">Seleccionar</option>
                {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select></label>
            </form>
            <button type="submit" className="btn btn-primary">Registrar maestro</button>
          </div>
        )}
      </div>
    </>
  );
}
