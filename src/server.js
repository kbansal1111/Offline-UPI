const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const models = require('./models');
const demoService = require('./services/DemoService');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', apiRoutes);

// Serve dashboard at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Initialize database and seed data
async function initialize() {
  try {
    await models.syncDatabase();
    await demoService.seedAccounts();
    
    app.listen(PORT, () => {
      console.log(`UPI Offline Mesh Node.js server running on http://localhost:${PORT}`);
      console.log('Open http://localhost:8080 to access the dashboard');
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initialize();
