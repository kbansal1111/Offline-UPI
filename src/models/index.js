const { Sequelize } = require('sequelize');
const Account = require('./Account');
const Transaction = require('./Transaction');

// Initialize Sequelize with SQLite for demo (zero setup)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './upimesh.db',
  logging: false,
  define: {
    timestamps: false
  }
});

// Initialize models
const models = {
  Account: Account(sequelize),
  Transaction: Transaction(sequelize),
  sequelize
};

// Sync database
models.syncDatabase = async () => {
  await sequelize.sync({ force: true });
  console.log('Database synced successfully');
};

module.exports = models;
