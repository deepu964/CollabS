import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import invitationRoutes from './routes/invitations.js';
import chatRoutes from './routes/chat.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    platform: 'CollabS Modern Multi-Project Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', invitationRoutes);
app.use('/api', chatRoutes);

// 404 Handler for undefined API routes (Express 5 compatible)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: `API route ${req.originalUrl} not found.`
    });
  }
  next();
});

// Start Server (only when running as standalone Node process, not in Vercel Serverless)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CollabS Backend] Server running on http://127.0.0.1:${PORT} (http://localhost:${PORT})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[CollabS Backend] FATAL: Port ${PORT} is already in use by another process.`);
      console.error(`[CollabS Backend] Run 'Stop-Process -Name node -Force' in PowerShell to free it, or change PORT in .env.\n`);
    } else {
      console.error('[CollabS Backend] Server error:', err);
    }
    process.exit(1);
  });
}

export default app;
