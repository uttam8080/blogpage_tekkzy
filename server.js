import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './authRoutes.js';
import postRoutes from './postRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json()); // Parses incoming JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serves static files

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

// Route alias for blogs page
app.get('/blogs', (req, res) => {
  res.redirect('/blogs.html');
});

// Start Server
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

export default app;
