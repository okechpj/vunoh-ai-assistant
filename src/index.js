require('dotenv').config();
const express = require('express');
const tasksRoutes = require('./routes/tasksRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', tasksRoutes);
app.use('/api/ai', aiRoutes);
// mount AI endpoint handler directly as a POST route
// app.use('/api', generate.generateResponse);

app.listen(PORT, () => {
  console.log(`Vunoh skeleton API running on port ${PORT}`);
});
