/**
 * Constantes reutilizables para validación en DTOs.
 * Centraliza longitudes máximas y rangos numéricos.
 */

/** Longitud máxima estándar para correo electrónico (RFC) */
export const EMAIL_MAX_LENGTH = 254;

/** Longitud máxima para nombres y apellidos */
export const NAME_MAX_LENGTH = 100;

/** Longitud máxima para teléfono */
export const PHONE_MAX_LENGTH = 20;

/** Contraseña: mínimo de caracteres */
export const PASSWORD_MIN_LENGTH = 6;

/** Grado escolar (1-9 para flexibilidad) */
export const GRADO_MIN = 1;
export const GRADO_MAX = 9;

/** ID positivo (entero >= 1) */
export const ID_MIN = 1;

/** Valor de búsqueda (query): límite para evitar payloads enormes y abusos con LIKE */
export const MAX_SEARCH_VALUE_LENGTH = 200;

/** Nombre de campo en búsqueda: solo se permiten los de la whitelist en código, este es el máximo length por si acaso */
export const MAX_SEARCH_FIELD_LENGTH = 50;

/** Paginación: máximo de ítems por página para evitar sobrecarga */
export const MAX_PAGE_SIZE = 100;

/** Paginación: máximo número de página razonable (evitar offset gigante) */
export const MAX_PAGE_NUMBER = 10000;
