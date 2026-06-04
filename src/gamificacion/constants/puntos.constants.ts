export const PUNTOS = {
  SEGMENTO_LEIDO: 10,
  EVALUACION_APROBADA: 25,
  EVALUACION_PERFECTA: 50,       // sin errores
  LIBRO_COMPLETADO: 100,
  RACHA_DIA: 15,                  // bonus por mantener racha
  NIVEL_AVANZADO: 30,             // bonus al subir de nivel en perfil adaptativo
} as const;

export const REGLAS_INSIGNIA = {
  RACHA_3_DIAS: 3,
  RACHA_7_DIAS: 7,
  ANOTACIONES_PARA_INSIGNIA: 10,
  SUBRAYADOS_PARA_INSIGNIA: 5,
  LIBROS_EXPLORADOR: 3,
  SESIONES_CONSTANTE: 5,
} as const;
