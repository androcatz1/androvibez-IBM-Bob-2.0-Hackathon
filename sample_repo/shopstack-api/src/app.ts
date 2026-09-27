import express from 'express';
import { getDatabase } from './config/database';
import { createRouter } from './routes/index';

const app = express();
app.use(express.json());

const db = getDatabase();
app.use('/api', createRouter(db));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`shopstack-api running on http://localhost:${PORT}`);
});

export default app;
