import { createApp } from './app';
import { config } from './config';
import { PgStore } from './db/pgStore';

const app = createApp(new PgStore());

app.listen(config.port, '0.0.0.0', () => {
  console.log(`GPT shop listening on ${config.port}`);
});
