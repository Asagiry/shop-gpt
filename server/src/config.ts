import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/app',
  jwtSecret: process.env.JWT_SECRET ?? 'local-dev-secret',
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://gpt-shop.voimaxgm.online',
  rootDir: path.resolve(__dirname, '../..'),
  clientDist: path.resolve(__dirname, '../../client/dist')
};
