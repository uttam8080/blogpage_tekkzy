// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './authRoutes.js';
import postRoutes from './postRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json()); // Parses incoming JSON request bodies
app.use(express.static('public')); // Serves tester UI

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

// Route alias for blogs page
app.get('/blogs', (req, res) => {
  res.redirect('/blogs.html');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
