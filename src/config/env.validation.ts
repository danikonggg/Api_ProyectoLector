/**
 * Validación de variables de entorno al arrancar la aplicación.
 * Falla el bootstrap si faltan variables críticas en producción.
 */
export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const errors: string[] = [];

  if (isProd) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32 || secret.includes('cambiar')) {
      errors.push('JWT_SECRET debe tener al menos 32 caracteres y ser único en producción.');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuración inválida:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
}
