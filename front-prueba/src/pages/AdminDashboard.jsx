import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { api, apiUpload, getBaseUrl, getToken } from '../api/api';

function CargaMasivaAdmin({ escuela, setEscuela, setMsg, loadEscuelas }) {
  const [tipo, setTipo] = useState('alumno');
  const [file, setFile] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const descargarPlantilla = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/escuelas/plantilla-carga-masiva`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'plantilla-carga-masiva.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Error al descargar plantilla' });
    }
  };

  const subir = async (e) => {
    e.preventDefault();
    if (!file) return;
    setMsg(null);
    setResultado(null);
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo', tipo);
      const r = await apiUpload(`/escuelas/${escuela.id}/carga-masiva`, fd);
      setResultado(r);
      setMsg({ type: 'success', text: r?.message || `Creados: ${r?.creados ?? 0}, errores: ${r?.totalErrores ?? 0}` });
      setFile(null);
      loadEscuelas?.();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setSubiendo(false);
    }
  };

  const descargarCredenciales = () => {
    if (!resultado?.excelBase64) return;
    const a = document.createElement('a');
    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${resultado.excelBase64}`;
    a.download = 'credenciales.xlsx';
    a.click();
  };

  return (
    <section className="page-section detail-panel">
      <div className="detail-panel__header">
        <span className="detail-panel__title">Carga masiva — {escuela.nombre}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEscuela(null); setResultado(null); }}>Cerrar</button>
      </div>
      <p className="card-desc">Descarga la plantilla, complétala y sube el Excel.</p>
      <div className="page-section__toolbar" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={descargarPlantilla}>Descargar plantilla Excel</button>
      </div>
      <form onSubmit={subir} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 500 }}>
        <label>
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="alumno">Alumnos</option>
            <option value="maestro">Maestros</option>
          </select>
        </label>
        <label>
          <span>Archivo Excel</span>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0])} required disabled={subiendo} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={subiendo || !file} style={{ gridColumn: '1 / -1' }}>
          {subiendo ? 'Subiendo...' : 'Subir y crear'}
        </button>
      </form>
      {resultado?.excelBase64 && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }} onClick={descargarCredenciales}>
          Descargar credenciales generadas
        </button>
      )}
    </section>
  );
}

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
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="page-section">
        <h2 className="page-section__title">Logs de auditoría</h2>
        <p className="card-desc">Registro de acciones sensibles: logins, registros, creación/edición de escuelas y libros.</p>
        <div className="page-section__toolbar">
          <button type="button" className="btn btn-primary btn-sm" onClick={loadLogs} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
        <div className="data-table-wrap">
          {logs.length === 0 ? (
            <div className="empty-state">Sin registros.</div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Usuario ID</th>
                    <th>IP</th>
                    <th>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="cell-muted" style={{ whiteSpace: 'nowrap' }}>{formatFecha(l.fecha)}</td>
                      <td><span className="badge badge-admin">{accionLabel(l.accion)}</span></td>
                      <td className="cell-muted">{l.usuarioId ?? '-'}</td>
                      <td className="cell-muted" style={{ fontFamily: 'var(--font-mono)' }}>{l.ip ?? '-'}</td>
                      <td className="cell-muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.detalles}>{l.detalles ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="pagination">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
                  <span className="pagination-info">Página {page} de {totalPages} ({total} registros)</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
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
  const [directoresEscuela, setDirectoresEscuela] = useState(null);
  const [todosDirectores, setTodosDirectores] = useState([]);
  const [loadingDirectores, setLoadingDirectores] = useState(false);
  const [cargaMasivaEscuela, setCargaMasivaEscuela] = useState(null);

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

  const verDirectoresEscuela = async (escuela) => {
    setMsg(null);
    try {
      const data = await api('GET', `/escuelas/${escuela.id}/directores`);
      setDirectoresEscuela({ id: escuela.id, nombre: escuela.nombre, list: data?.data || [] });
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const loadTodosDirectores = async () => {
    setLoadingDirectores(true);
    setMsg(null);
    try {
      const data = await api('GET', '/escuelas/directores');
      setTodosDirectores(data?.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setLoadingDirectores(false);
    }
  };

  return (
    <>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="page-section">
        <h2 className="page-section__title">Crear escuela</h2>
        <div className="card">
          <form onSubmit={crearEscuela} className="form-grid">
            <label><span>Nombre</span><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
            <label><span>Nivel</span><input value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} placeholder="Primaria" required /></label>
            <label><span>Clave</span><input value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} /></label>
            <label><span>Dirección</span><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></label>
            <label><span>Teléfono</span><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
          </form>
          <button type="submit" className="btn btn-primary" onClick={crearEscuela}>Crear escuela</button>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Otorgar libro a escuela (Paso 1)</h2>
        <p className="card-desc">Admin otorga. La escuela debe canjear el código después.</p>
        <div className="card">
          <form onSubmit={otorgarLibro} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}>
            <label><span>Escuela</span><select value={otorgarForm.escuelaId} onChange={(e) => setOtorgarForm({ ...otorgarForm, escuelaId: e.target.value })} required>
              <option value="">Seleccionar</option>
              {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre} (ID {e.id})</option>)}
            </select></label>
            <label><span>Código del libro</span><input value={otorgarForm.codigo} onChange={(e) => setOtorgarForm({ ...otorgarForm, codigo: e.target.value })} placeholder="LIB-..." required /></label>
          </form>
          <button type="submit" className="btn btn-primary">Otorgar libro</button>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Lista de escuelas</h2>
        <div className="page-section__toolbar">
          <button className="btn btn-primary btn-sm" onClick={loadEscuelas} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar lista'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={loadTodosDirectores} disabled={loadingDirectores}>
            {loadingDirectores ? 'Cargando...' : 'Ver todos los directores'}
          </button>
        </div>
        <div className="data-table-wrap">
          {escuelas.length === 0 ? (
            <div className="empty-state">Sin escuelas. Carga la lista o crea una arriba.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Nivel</th>
                  <th>Clave</th>
                  <th>Dirección</th>
                  <th className="cell-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {escuelas.map((e) => (
                  <tr key={e.id}>
                    <td className="cell-muted">{e.id}</td>
                    <td><strong>{e.nombre}</strong></td>
                    <td>{e.nivel}</td>
                    <td className="cell-muted">{e.clave ?? '-'}</td>
                    <td className="cell-muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.direccion}>{e.direccion ?? '-'}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => verLibros(e.id)}>Libros</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => verDirectoresEscuela(e)}>Directores</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCargaMasivaEscuela(e)}>Carga masiva</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {todosDirectores.length > 0 && (
        <section className="page-section">
          <h2 className="page-section__title">Todos los directores del sistema</h2>
          <div className="page-section__toolbar">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTodosDirectores([])}>Cerrar</button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Director</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Escuela</th>
                  <th>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {todosDirectores.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.persona?.nombre} {d.persona?.apellido}</strong></td>
                    <td className="cell-muted">{d.persona?.correo ?? '-'}</td>
                    <td className="cell-muted">{d.persona?.telefono ?? '-'}</td>
                    <td>{d.escuela?.nombre ?? '-'}</td>
                    <td className="cell-muted">{d.escuela?.nivel ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {directoresEscuela && (
        <section className="page-section detail-panel">
          <div className="detail-panel__header">
            <span className="detail-panel__title">Directores de {directoresEscuela.nombre}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDirectoresEscuela(null)}>Cerrar</button>
          </div>
          {directoresEscuela.list.length === 0 ? (
            <div className="empty-state">Esta escuela no tiene directores registrados.</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Nombramiento</th>
                  </tr>
                </thead>
                <tbody>
                  {directoresEscuela.list.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.persona?.nombre} {d.persona?.apellido}</strong></td>
                      <td className="cell-muted">{d.persona?.correo ?? '-'}</td>
                      <td className="cell-muted">{d.persona?.telefono ?? '-'}</td>
                      <td className="cell-muted">{d.fechaNombramiento ? new Date(d.fechaNombramiento).toLocaleDateString('es-MX') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {librosEscuela && (
        <section className="page-section detail-panel">
          <div className="detail-panel__header">
            <span className="detail-panel__title">Libros de la escuela ID {librosEscuela.id}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLibrosEscuela(null)}>Cerrar</button>
          </div>
          <p className="card-desc"><strong>Activos:</strong> {librosEscuela.activos.length} · <strong>Pendientes de canjear:</strong> {librosEscuela.pendientes.length}</p>
        </section>
      )}

      {cargaMasivaEscuela && (
        <CargaMasivaAdmin escuela={cargaMasivaEscuela} setEscuela={setCargaMasivaEscuela} setMsg={setMsg} loadEscuelas={loadEscuelas} />
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
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="page-section">
        <h2 className="page-section__title">Cargar libro (PDF)</h2>
        <div className="card">
          <form onSubmit={cargarLibro} className="form-grid">
            <label><span>Archivo PDF</span><input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0])} required disabled={uploading} /></label>
            <label><span>Título</span><input value={cargarForm.titulo} onChange={(e) => setCargarForm({ ...cargarForm, titulo: e.target.value })} required /></label>
            <label><span>Grado</span><input type="number" value={cargarForm.grado} onChange={(e) => setCargarForm({ ...cargarForm, grado: e.target.value })} required /></label>
            <label><span>Descripción</span><input value={cargarForm.descripcion} onChange={(e) => setCargarForm({ ...cargarForm, descripcion: e.target.value })} /></label>
            <label><span>Código</span><input value={cargarForm.codigo} onChange={(e) => setCargarForm({ ...cargarForm, codigo: e.target.value })} placeholder="opcional" /></label>
          </form>
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? 'Cargando PDF... (puede tardar)' : 'Cargar libro'}
          </button>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Catálogo de libros</h2>
        <div className="page-section__toolbar">
          <button type="button" className="btn btn-primary btn-sm" onClick={loadLibros} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
        <div className="data-table-wrap">
          {libros.length === 0 ? (
            <div className="empty-state">Sin libros. Carga uno arriba.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Grado</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th className="cell-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {libros.map((l) => (
                  <tr key={l.id}>
                    <td className="cell-muted">{l.id}</td>
                    <td><strong>{l.titulo}</strong></td>
                    <td>{l.grado}</td>
                    <td className="cell-muted">{l.codigo ?? '-'}</td>
                    <td className="cell-muted">{l.estado ?? '-'}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => descargarPdf(l.id)}>Descargar PDF</button>
                    </td>
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
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="page-section">
        <h2 className="page-section__title">Alumnos y Padres</h2>
        <div className="page-section__toolbar">
          <button type="button" className={`btn btn-sm ${tab === 'alumnos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('alumnos')}>Alumnos</button>
          <button type="button" className={`btn btn-sm ${tab === 'padres' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('padres')}>Padres / Tutores</button>
        </div>

        {tab === 'alumnos' && (
          <>
            <div className="page-section__toolbar">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="cell-muted" style={{ fontSize: '0.875rem' }}>Filtrar por escuela:</span>
                <select value={filtroEscuela} onChange={(e) => setFiltroEscuela(e.target.value)} style={{ padding: '0.4rem 0.6rem', minWidth: 220 }}>
                  <option value="">Todas</option>
                  {escuelas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-primary btn-sm" onClick={loadAlumnos} disabled={loading}>
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
            <div className="data-table-wrap">
              {alumnos.length === 0 ? (
                <div className="empty-state">Sin alumnos.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Grado · Escuela</th>
                      <th>Padre / Tutor</th>
                      <th className="cell-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.persona?.nombre} {a.persona?.apellido}</strong></td>
                        <td className="cell-muted">Grado {a.grado} · {a.escuela?.nombre || `ID ${a.escuelaId}`}</td>
                        <td className="cell-muted">
                          {a.padre ? `${a.padre.persona?.nombre} ${a.padre.persona?.apellido}` : 'Sin padre asignado'}
                        </td>
                        <td className="cell-actions">
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => verAlumno(a.id)}>Ver detalle</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'padres' && (
          <>
            <div className="page-section__toolbar">
              <button type="button" className="btn btn-primary btn-sm" onClick={loadPadres} disabled={loading}>
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
            <div className="data-table-wrap">
              {padres.length === 0 ? (
                <div className="empty-state">Sin padres registrados.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Hijos</th>
                      <th className="cell-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {padres.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.persona?.nombre} {p.persona?.apellido}</strong></td>
                        <td className="cell-muted">{p.persona?.correo ?? '-'}</td>
                        <td className="cell-muted">{p.cantidadHijos !== undefined ? `${p.cantidadHijos} hijo(s)` : '-'}</td>
                        <td className="cell-actions">
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => verPadre(p.id)}>Ver hijos</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>

      {detalleAlumno && (
        <section className="page-section detail-panel">
          <div className="detail-panel__header">
            <span className="detail-panel__title">Detalle del alumno</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalleAlumno(null)}>Cerrar</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div><span className="cell-muted" style={{ fontSize: '0.75rem' }}>Nombre</span><p>{detalleAlumno.persona?.nombre} {detalleAlumno.persona?.apellido}</p></div>
            <div><span className="cell-muted" style={{ fontSize: '0.75rem' }}>Email</span><p>{detalleAlumno.persona?.correo ?? '-'}</p></div>
            <div><span className="cell-muted" style={{ fontSize: '0.75rem' }}>Grado · Grupo</span><p>{detalleAlumno.grado} · {detalleAlumno.grupo || '-'}</p></div>
            <div><span className="cell-muted" style={{ fontSize: '0.75rem' }}>Escuela</span><p>{detalleAlumno.escuela?.nombre || `ID ${detalleAlumno.escuelaId}`}</p></div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <span className="cell-muted" style={{ fontSize: '0.75rem' }}>Padre / Tutor</span>
            {detalleAlumno.padre ? (
              <div className="card" style={{ marginTop: '0.35rem', padding: '0.75rem' }}>
                <p><strong>{detalleAlumno.padre.persona?.nombre} {detalleAlumno.padre.persona?.apellido}</strong></p>
                <p className="cell-muted" style={{ fontSize: '0.875rem' }}>{detalleAlumno.padre.persona?.correo}</p>
                {detalleAlumno.padre.parentesco && <span className="badge badge-admin">{detalleAlumno.padre.parentesco}</span>}
              </div>
            ) : (
              <p className="cell-muted" style={{ marginTop: '0.35rem' }}>Sin padre asignado</p>
            )}
          </div>
        </section>
      )}

      {detallePadre && (
        <section className="page-section detail-panel">
          <div className="detail-panel__header">
            <span className="detail-panel__title">Padre / Tutor y sus hijos</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetallePadre(null)}>Cerrar</button>
          </div>
          <p><strong>{detallePadre.persona?.nombre} {detallePadre.persona?.apellido}</strong></p>
          <p className="cell-muted" style={{ marginBottom: '1rem' }}>{detallePadre.persona?.correo}</p>
          <span className="cell-muted" style={{ fontSize: '0.75rem' }}>Hijos ({detallePadre.alumnos?.length || 0})</span>
          {(!detallePadre.alumnos || detallePadre.alumnos.length === 0) ? (
            <p className="cell-muted" style={{ marginTop: '0.5rem' }}>Sin hijos registrados.</p>
          ) : (
            <div className="data-table-wrap" style={{ marginTop: '0.5rem' }}>
              <table className="data-table">
                <thead><tr><th>Nombre</th><th>Grado · Escuela</th><th className="cell-actions">Acciones</th></tr></thead>
                <tbody>
                  {detallePadre.alumnos.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.persona?.nombre} {a.persona?.apellido}</strong></td>
                      <td className="cell-muted">Grado {a.grado} · {a.escuela?.nombre || `ID ${a.escuelaId}`}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => { setDetallePadre(null); verAlumno(a.id); }}>Ver alumno</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="page-section">
        <h2 className="page-section__title">Registro de usuarios</h2>
        <div className="page-section__toolbar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { loadEscuelas(); loadAlumnos(); }}>Actualizar listas</button>
        </div>
        <div className="card">
          <div className="page-section__toolbar" style={{ marginBottom: '1rem' }}>
            {['alumno', 'padre', 'maestro', 'director', 'admin'].map((m) => (
              <button key={m} type="button" className={`btn btn-sm ${modoRegistro === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModoRegistro(m)}>
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
      </section>
    </>
  );
}
