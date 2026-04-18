require('dotenv').config();
const express = require('express');
const tasksRoutes = require('./routes/tasksRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/api', tasksRoutes);
app.use('/api/ai', aiRoutes);

app.listen(PORT, () => {
  console.log(`Vunoh skeleton API running on port ${PORT}`);
});
