// postRoutes.js
import express from 'express';
import prisma from './db.js';
import { verifyToken, verifyAdmin } from './authmiddleware.js';

const router = express.Router();

// 1. GET ALL APPROVED / PUBLISHED BLOG POSTS (Public & Website)
router.get('/', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        }
      }
    });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching blog posts', error: error.message });
  }
});

// 2. GET PENDING BLOG SUBMISSIONS (Admin Only)
router.get('/pending', verifyAdmin, async (req, res) => {
  try {
    const pendingPosts = await prisma.post.findMany({
      where: { published: false },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    res.status(200).json(pendingPosts);
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

    // Admin posts are published directly; regular user posts are stored in DB with published: false (Pending)
    const isPublished = isAdmin ? true : false;

    const post = await prisma.post.create({
      data: {
        title,
        content,
        published: isPublished,
        authorId: req.user.userId
      },
      include: {
        author: {
          select: {
            username: true,
            email: true
          }
        }
      }
    });

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

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { published: true },
      include: {
        author: {
          select: {
            username: true,
            email: true
          }
        }
      }
    });

    res.status(200).json({
      message: '✅ Blog post accepted and published to the website!',
      post: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting blog post', error: error.message });
  }
});

// 5. ADMIN REJECT BLOG POST (Deletes completely from PostgreSQL & website)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    await prisma.post.delete({
      where: { id }
    });

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

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    await prisma.post.delete({
      where: { id }
    });

    res.status(200).json({
      message: '🗑️ Blog post rejected and permanently deleted from PostgreSQL.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting blog post', error: error.message });
  }
});

export default router;
