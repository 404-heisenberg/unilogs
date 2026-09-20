import 'dotenv/config';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';

const port = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}

createApp().listen(port, () => {
  console.log(`UniLogs API listening on http://localhost:${port}`);
});
