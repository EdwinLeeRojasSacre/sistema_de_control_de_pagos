import 'dotenv/config';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET debe estar configurado para iniciar la aplicación.',
    );
  }

  return secret;
}
