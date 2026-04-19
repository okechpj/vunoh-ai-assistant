require('dotenv').config();
const express = require('express');
const path = require('path');
const tasksRoutes = require('./routes/tasksRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
const cookieParser = require('cookie-parser');
const requireAuth = require('./middleware/authMiddleware');

app.use(cookieParser());

// CORS for API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Serve static public files (public assets like login/register should be accessible)
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Deny direct access to raw frontend paths like /frontend/* — always redirect to login (will be guarded)
app.use('/frontend', (req, res) => res.redirect('/login.html'));

// Protect subsequent routes (API and app pages) with auth middleware
app.use(requireAuth);

// Serve protected frontend (chat app) after auth middleware so only authenticated users can access
app.use('/app', express.static(path.join(__dirname, '../../frontend/app')));

// Redirect root to protected app (will trigger auth middleware)
app.get('/', (req, res) => res.redirect('/app/'));

// Mount API routes
app.use('/api', tasksRoutes);
app.use('/api/ai', aiRoutes);
// Auth routes (exposed at /auth)
app.use('/auth', authRoutes);

// Also expose chat at /api/chat for convenience
if (aiRoutes && aiRoutes.chatHandler) app.post('/api/chat', aiRoutes.chatHandler);

// Catch-all 404 -> serve public/404.html
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../../frontend/public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`Vunoh skeleton API running on port ${PORT}`);
});
