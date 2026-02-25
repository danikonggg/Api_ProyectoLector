import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getBaseUrl, getToken } from '../api/api';
import './Home.css';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [libros, setLibros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [libroAbierto, setLibroAbierto] = useState(null);
  const [contenidoLibro, setContenidoLibro] = useState(null);
  const [progresoLectura, setProgresoLectura] = useState(0);
  const [unidadActiva, setUnidadActiva] = useState(null);
  const [ultimoSegmentoId, setUltimoSegmentoId] = useState(null);
  const readerRef = useRef(null);
  const saveProgresoTimeoutRef = useRef(null);

  const esAlumno = (user?.tipoPersona || '').toLowerCase() === 'alumno';
  const esAdmin = (user?.tipoPersona || '').toLowerCase() === 'administrador';

  useEffect(() => {
    if (esAlumno) {
      api('GET', '/escuelas/mis-libros')
        .then((r) => setLibros(r?.data ?? []))
        .catch((e) => setError(e?.data?.message || e?.message || 'No se pudieron cargar los libros'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [esAlumno]);

  const guardarProgreso = useCallback(async (libroId, porcentaje, segId) => {
    try {
      await api('PATCH', `/escuelas/mis-libros/${libroId}/progreso`, {
        porcentaje: Math.round(porcentaje),
        ...(segId && { ultimoSegmentoId: segId }),
      });
    } catch (e) {
      console.warn('No se pudo guardar progreso:', e?.message);
    }
  }, []);

  const abrirLibro = async (libro) => {
    setLibroAbierto(libro);
    setContenidoLibro(null);
    setProgresoLectura(libro.progreso ?? 0);
    setUnidadActiva(null);
    setUltimoSegmentoId(libro.ultimoSegmentoId ?? null);
    try {
      const r = await api('GET', `/libros/${libro.id}`);
      setContenidoLibro(r?.data);
    } catch (e) {
      setError(e?.data?.message || e?.message || 'No se pudo cargar el libro');
    }
  };

  const descargarPdf = async (id) => {
    try {
      const res = await fetch(`${getBaseUrl()}/libros/${id}/pdf`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${libroAbierto?.titulo || 'libro'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || 'Error al descargar PDF');
    }
  };

  const scrollToUnidad = (id) => {
    const el = document.getElementById(`unidad-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleReaderScroll = useCallback(() => {
    const el = readerRef.current;
    if (!el || !contenidoLibro?.unidades?.length) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const progress = Math.min(100, (scrollTop / (scrollHeight - clientHeight)) * 100);
    setProgresoLectura(progress);

    const unidades = contenidoLibro.unidades;
    const unitElements = unidades.map((u) => document.getElementById(`unidad-${u.id}`)).filter(Boolean);
    const viewportMid = scrollTop + clientHeight * 0.3;
    let segId = null;

    for (let i = unitElements.length - 1; i >= 0; i--) {
      const rect = unitElements[i].getBoundingClientRect();
      const elTop = rect.top + scrollTop - el.offsetTop;
      if (elTop <= viewportMid) {
        setUnidadActiva(unidades[i].id);
        const segs = unidades[i].segmentos || [];
        if (segs.length) segId = segs[segs.length - 1].id;
        break;
      }
    }

    if (libroAbierto?.id && esAlumno) {
      if (saveProgresoTimeoutRef.current) clearTimeout(saveProgresoTimeoutRef.current);
      saveProgresoTimeoutRef.current = setTimeout(() => {
        guardarProgreso(libroAbierto.id, progress, segId);
      }, 800);
    }
  }, [contenidoLibro, libroAbierto?.id, esAlumno, guardarProgreso]);

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleReaderScroll);
    handleReaderScroll();
    return () => el.removeEventListener('scroll', handleReaderScroll);
  }, [contenidoLibro, handleReaderScroll]);

  const tocItems = contenidoLibro?.unidades ?? [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="book-loader" />
          <p className="text-sm">Cargando tu biblioteca...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    return () => {
      if (saveProgresoTimeoutRef.current) clearTimeout(saveProgresoTimeoutRef.current);
    };
  }, []);

  return (
    <div className="home-alumno">
      <header className="home-header">
        <div>
          <h1>Mi Biblioteca</h1>
          <p className="home-subtitle">
            Hola, {user?.nombre}. {esAlumno ? 'Libros que tu maestro o director te asignó.' : 'Bienvenido.'}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-logout"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Cerrar sesión
        </button>
      </header>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {!esAlumno ? (
        <div className="card home-welcome-card">
          <h2 className="text-xl font-semibold mb-2">Bienvenido</h2>
          <p className="text-sm text-zinc-400 mb-6">
            {user?.nombre} {user?.apellido} · {user?.tipoPersona || '—'}
          </p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : libros.length === 0 ? (
        <div className="home-empty">
          <div className="book-stack-icon">📚</div>
          <h3>Sin libros asignados</h3>
          <p>Pide a tu maestro o director que te asigne libros. Ellos eligen qué libros puedes leer.</p>
        </div>
      ) : (
        <div className="book-shelf">
          <div className="shelf-label">Estantería digital</div>
          <div className="book-grid">
            {libros.map((libro, i) => (
              <div
                key={libro.id}
                className="book-card"
                data-color={i % 6}
                onClick={() => abrirLibro(libro)}
              >
                <div className="book-spine" />
                <div className="book-cover">
                  <div className="book-cover-inner">
                    <span className="book-grade">Grado {libro.grado}</span>
                    <h3 className="book-title">{libro.titulo}</h3>
                    {libro.descripcion && (
                      <p className="book-desc">{libro.descripcion}</p>
                    )}
                    {esAlumno && libro.progreso != null && libro.progreso > 0 && (
                      <span className="book-progress-badge">{libro.progreso}% leído</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {libroAbierto && (
        <div className="book-modal-overlay" onClick={() => setLibroAbierto(null)}>
          <div
            className="book-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="book-modal-header">
              <h2>{libroAbierto.titulo}</h2>
              <div className="book-modal-actions">
                {esAdmin && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => descargarPdf(libroAbierto.id)}
                  >
                    📥 Descargar PDF
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setLibroAbierto(null)}
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            {contenidoLibro && (
              <>
                <div className="book-progress-bar">
                  <div
                    className="book-progress-fill"
                    style={{ width: `${progresoLectura}%` }}
                  />
                </div>

                <div className="book-reader-wrapper">
                  {tocItems.length > 0 && (
                    <nav className="book-toc">
                      <div className="book-toc-title">Contenido</div>
                      {tocItems.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`book-toc-item ${unidadActiva === u.id ? 'active' : ''}`}
                          onClick={() => scrollToUnidad(u.id)}
                        >
                          {u.nombre}
                        </button>
                      ))}
                    </nav>
                  )}

                  <div
                    className="book-reader"
                    ref={readerRef}
                  >
                    {!contenidoLibro ? (
                      <div className="book-loader" style={{ margin: '3rem auto' }} />
                    ) : (
                      <div className="book-reader-inner">
                        <div className="book-content">
                          {contenidoLibro.unidades?.map((unidad) => (
                            <section
                              key={unidad.id}
                              id={`unidad-${unidad.id}`}
                              className="book-unit"
                            >
                              <h3 className="unit-title">{unidad.nombre}</h3>
                              {unidad.segmentos?.map((seg) => (
                                <div key={seg.id} className="segment">
                                  <p className="seg-paragraph">{seg.contenido || ''}</p>
                                </div>
                              ))}
                            </section>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {!contenidoLibro && (
              <div className="book-reader flex items-center justify-center">
                <div className="book-loader" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
