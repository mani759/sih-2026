// Vercel serverless entry for the Express API.
// Mounts the same apiRouter used by server.ts; scripts/build-vercel.mjs bundles this file
// into .vercel/output/functions/api.func so every /api/* request runs through Express on Vercel.
import express from 'express';
import { apiRouter } from '../server/routes/api';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

export default app;
