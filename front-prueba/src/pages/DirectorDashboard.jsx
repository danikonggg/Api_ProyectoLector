import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api, apiUpload, getBaseUrl, getToken } from '../api/api';
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
  const [editandoMaestro, setEditandoMaestro] = useState(null);
  const [formEditMaestro, setFormEditMaestro] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', correo: '', telefono: '', password: '' });

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

  const abrirEditarMaestro = (m) => {
    setEditandoMaestro(m);
    setFormEditMaestro({
      nombre: m.persona?.nombre ?? '',
      apellidoPaterno: m.persona?.apellidoPaterno ?? m.persona?.apellido ?? '',
      apellidoMaterno: m.persona?.apellidoMaterno ?? '',
      correo: m.persona?.correo ?? '',
      telefono: m.persona?.telefono ?? '',
      password: '',
    });
  };

  const actualizarMaestro = async (e) => {
    e.preventDefault();
    if (!editandoMaestro) return;
    setMsg(null);
    try {
      const payload = {
        nombre: formEditMaestro.nombre,
        apellidoPaterno: formEditMaestro.apellidoPaterno,
        apellidoMaterno: formEditMaestro.apellidoMaterno,
        correo: formEditMaestro.correo,
        telefono: formEditMaestro.telefono || null,
      };
      if (formEditMaestro.password?.trim()) payload.password = formEditMaestro.password;
      await api('PATCH', `/personas/maestros/${editandoMaestro.id}`, payload);
      setMsg({ type: 'success', text: 'Maestro actualizado' });
      setEditandoMaestro(null);
      loadAll();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    }
  };

  const eliminarMaestro = async (m) => {
    if (!window.confirm(`¿Eliminar al maestro ${m.persona?.nombre ?? ''} ${m.persona?.apellido ?? ''}? Esta acción no se puede deshacer.`)) return;
    setMsg(null);
    try {
      await api('DELETE', `/personas/maestros/${m.id}`);
      setMsg({ type: 'success', text: 'Maestro eliminado' });
      if (editandoMaestro?.id === m.id) setEditandoMaestro(null);
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
        <p className="card-desc">Registra, edita o elimina maestros de tu escuela.</p>
        <div className="data-table-wrap">
          {maestros.length === 0 ? (
            <div className="empty-state">Sin maestros. Regístra uno arriba.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Especialidad</th><th className="cell-actions">Acciones</th></tr></thead>
              <tbody>
                {maestros.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.persona?.nombre} {m.persona?.apellido}</strong></td>
                    <td className="cell-muted">{m.persona?.correo ?? '-'}</td>
                    <td className="cell-muted">{m.especialidad ?? '-'}</td>
                    <td className="cell-actions" style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => abrirEditarMaestro(m)}>Editar</button>
                      <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--danger, #dc2626)' }} onClick={() => eliminarMaestro(m)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {editandoMaestro && (
          <div className="card" style={{ marginTop: '1rem', padding: '1.25rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong>Editar maestro: {editandoMaestro.persona?.nombre} {editandoMaestro.persona?.apellido}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditandoMaestro(null)}>Cerrar</button>
            </div>
            <form onSubmit={actualizarMaestro} className="form-grid">
              {['nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'password'].map((k) => (
                <label key={k}>
                  <span>{k === 'correo' ? 'Correo' : k === 'password' ? 'Nueva contraseña (opcional)' : k}</span>
                  <input
                    type={k === 'password' ? 'password' : 'text'}
                    value={formEditMaestro[k]}
                    onChange={(e) => setFormEditMaestro({ ...formEditMaestro, [k]: e.target.value })}
                    placeholder={k === 'password' ? 'Dejar vacío para no cambiar' : ''}
                    required={k !== 'password' && k !== 'telefono'}
                  />
                </label>
              ))}
              <button type="submit" className="btn btn-primary">Guardar cambios</button>
            </form>
          </div>
        )}
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Carga masiva desde Excel</h2>
        <p className="card-desc">Sube un Excel con alumnos o maestros. Usa la plantilla para el formato correcto.</p>
        <CargaMasiva loadAll={loadAll} setMsg={setMsg} />
      </section>

      <section className="page-section">
        <h2 className="page-section__title">Asignar libro a alumno</h2>
        <p className="card-desc">Selecciona un alumno, luego el libro que coincida con su grado. El alumno solo verá los libros que le asignes.</p>
        <AsignarLibroAlumno
          alumnos={alumnos}
          loadAll={loadAll}
          esDirector
          setMsg={setMsg}
        />
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

function CargaMasiva({ loadAll, setMsg }) {
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
      const r = await apiUpload('/director/carga-masiva', fd);
      if (r && typeof r === 'object' && !r.message) {
        setResultado(r);
      }
      setMsg({ type: 'success', text: r?.message || `Creados: ${r?.creados ?? 0}, errores: ${r?.totalErrores ?? 0}` });
      setFile(null);
      loadAll?.();
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
    <div className="card">
      <div className="page-section__toolbar" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={descargarPlantilla}>
          Descargar plantilla Excel
        </button>
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
    </div>
  );
}

function AsignarLibroAlumno({ alumnos, loadAll, esDirector, setMsg }) {
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
    const path = esDirector ? '/director/libros-disponibles-para-asignar' : '/maestros/libros-disponibles-para-asignar';
    api('GET', `${path}?alumnoId=${alumnoId}`)
      .then((r) => setLibrosDisponibles(r?.data ?? []))
      .catch((e) => setMsg({ type: 'error', text: e?.data?.message || e?.message }))
      .finally(() => setLoadingLibros(false));
  }, [alumnoId, esDirector]);

  const asignar = async (e) => {
    e.preventDefault();
    if (!alumnoId || !libroId) return;
    setMsg(null);
    setAsignando(true);
    try {
      const path = esDirector ? '/director/asignar-libro' : '/maestros/asignar-libro';
      await api('POST', path, { alumnoId: Number(alumnoId), libroId: Number(libroId) });
      setMsg({ type: 'success', text: 'Libro asignado correctamente' });
      setAlumnoId('');
      setLibroId('');
      setLibrosDisponibles([]);
      loadAll?.();
    } catch (e) {
      setMsg({ type: 'error', text: e?.data?.message || e?.message });
    } finally {
      setAsignando(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={asignar} className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 500 }}>
        <label>
          <span>Alumno</span>
          <select value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)} required>
            <option value="">Seleccionar</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.persona?.nombre} {a.persona?.apellido} — Grado {a.grado}{a.grupo ? ` ${a.grupo}` : ''}</option>
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
