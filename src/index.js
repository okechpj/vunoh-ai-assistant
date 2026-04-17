require('dotenv').config();
const express = require('express');
const tasksRoutes = require('./routes/tasksRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
  res.send("hello world")
});

app.use('/api', tasksRoutes);

app.listen(PORT, () => {
  console.log(`Vunoh skeleton API running on port ${PORT}`);
});
