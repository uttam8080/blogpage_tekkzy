// postRoutes.js - Blog post routes using PostgreSQL ('pg')
import express from 'express';
import crypto from 'crypto';
import pool from './db.js';
import { verifyToken, verifyAdmin } from './authMiddleware.js';

const router = express.Router();

// 1. GET ALL APPROVED / PUBLISHED BLOG POSTS (Public & Website)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.published, 
        p."createdAt", 
        p."updatedAt", 
        p."authorId",
        json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email,
          'role', u.role
        ) AS author
      FROM "Post" p
      LEFT JOIN "User" u ON p."authorId" = u.id
      WHERE p.published = true
      ORDER BY p."createdAt" DESC
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching blog posts', error: error.message });
  }
});

// 2. GET PENDING BLOG SUBMISSIONS (Admin Only)
router.get('/pending', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.published, 
        p."createdAt", 
        p."updatedAt", 
        p."authorId",
        json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email
        ) AS author
      FROM "Post" p
      LEFT JOIN "User" u ON p."authorId" = u.id
      WHERE p.published = false
      ORDER BY p."createdAt" DESC
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending posts', error: error.message });
  }
});

// 3. CREATE A NEW BLOG POST (Protected by JWT)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    const isAdmin = req.user.role === 'ADMIN' || (req.user.email && req.user.email.toLowerCase() === 'adminuser@gmail.com');

    // Admin posts are published directly; regular user posts are stored with published = false (Pending)
    const isPublished = Boolean(isAdmin);
    const postId = crypto.randomUUID();

    const insertResult = await pool.query(
      `INSERT INTO "Post" (id, title, content, published, "authorId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, title, content, published, "authorId", "createdAt", "updatedAt"`,
      [postId, title.trim(), content.trim(), isPublished, req.user.userId]
    );

    const post = insertResult.rows[0];
    post.author = {
      id: req.user.userId,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    };

    res.status(201).json({
      message: isPublished
        ? 'Blog post published successfully to the website!'
        : 'Blog post saved in PostgreSQL! It is pending admin review and will appear on the website once accepted.',
      post,
      isPending: !isPublished
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating blog post', error: error.message });
  }
});

// 4. ADMIN ACCEPT BLOG POST (Publishes to website)
router.put('/:id/accept', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM "Post" WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    await pool.query(
      'UPDATE "Post" SET published = true, "updatedAt" = NOW() WHERE id = $1',
      [id]
    );

    const updatedResult = await pool.query(`
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.published, 
        p."createdAt", 
        p."updatedAt", 
        p."authorId",
        json_build_object(
          'username', u.username,
          'email', u.email
        ) AS author
      FROM "Post" p
      LEFT JOIN "User" u ON p."authorId" = u.id
      WHERE p.id = $1
    `, [id]);

    res.status(200).json({
      message: '✅ Blog post accepted and published to the website!',
      post: updatedResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting blog post', error: error.message });
  }
});

// 5. ADMIN REJECT BLOG POST (Deletes completely from PostgreSQL & website)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM "Post" WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    await pool.query('DELETE FROM "Post" WHERE id = $1', [id]);

    res.status(200).json({
      message: '🗑️ Blog post rejected and permanently deleted from PostgreSQL.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting blog post', error: error.message });
  }
});

// Alias for reject via POST/PUT
router.post('/:id/reject', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM "Post" WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    await pool.query('DELETE FROM "Post" WHERE id = $1', [id]);

    res.status(200).json({
      message: '🗑️ Blog post rejected and permanently deleted from PostgreSQL.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting blog post', error: error.message });
  }
});

export default router;
