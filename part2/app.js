const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));
// Added this to parse forms
app.use(express.urlencoded({extended: true}));

const session = require('express-session');

app.use(session({
    secret: "helloEXAM",
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false}
}));

// Added the '/api/dogs'
app.get('/api/dogs', async (req, res) => {
  try {
    const [dogs] = await db.execute('select name as dog_name, size, Users.username as owner_username from Dogs join Users on Dogs.owner_id = Users.user_id');
    res.json(dogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

// Added this aswell
app.use('/', userRoutes);

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

// Export the app instead of listening here
module.exports = app;