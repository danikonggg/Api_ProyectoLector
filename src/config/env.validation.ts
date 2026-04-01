export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const errors: string[] = [];

  const required = ['JWT_SECRET', 'DB_HOST', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'];
  if (!process.env.DATABASE_URL?.trim()) {
    for (const key of required) {
      if (!process.env[key]?.trim()) errors.push(`${key} es obligatorio.`);
    }
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /cambiar|default|secret|password/i.test(secret)) {
    errors.push('JWT_SECRET debe tener ≥32 caracteres aleatorios (sin palabras predecibles).');
  }

  if (isProd) {
    if (!process.env.CORS_ORIGINS?.trim()) {
      errors.push('CORS_ORIGINS es obligatorio en producción.');
    }
    const pwdMin = process.env.PASSWORD_MIN_LENGTH;
    if (pwdMin && parseInt(pwdMin, 10) < 6) {
      errors.push('PASSWORD_MIN_LENGTH debe ser ≥6 en producción.');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuración inválida:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
}
