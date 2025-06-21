var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');
const { useSyncExternalStore } = require('react');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;

(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    // Create the database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();

    // Now connect to the created database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    // Creates tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner', 'walker') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS Dogs (
        dog_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        size ENUM('small', 'medium', 'large') NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRequests (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        CONSTRAINT unique_application UNIQUE (request_id, walker_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkApplications (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        CONSTRAINT unique_application UNIQUE (request_id, walker_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRatings (
        rating_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        owner_id INT NOT NULL,
        rating INT CHECK (rating BETWEEN 1 AND 5),
        comments TEXT,
        rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        FOREIGN KEY (owner_id) REFERENCES Users(user_id),
        CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
      )
    `);

    // Insert data
    const [rows] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (rows[0].count === 0) {
      await db.execute(`
        insert into Users (username, email, password_hash, role) values ('alice123', 'alice@example.com', 'hashed123', 'owner'), ('bobwalker', 'bob@example.com', 'hashed456', 'walker'), ('carol123', 'carol@example.com', 'hashed789', 'owner'), ('kobi123', 'kobi@example.com', 'hashed101112', 'owner'), ('selina123', 'selina@example.com', 'hashed131415', 'walker')
      `);
      await db.execute(`
        insert into Dogs (owner_id, name, size) values ((select user_id from Users where username ='alice123'), 'Max', 'medium');
      `);
      await db.execute(`
        insert into Dogs (owner_id, name, size) values ((select user_id from Users where username ='carol123'), 'Bella', 'small');
      `);
      await db.execute(`
        insert into Dogs (owner_id, name, size) values ((select user_id from Users where username ='kobi123'), 'Ruby', 'small');
      `);
      await db.execute(`
        insert into Dogs (owner_id, name, size) values ((select user_id from Users where username ='kobi123'), 'Hunter', 'large');
      `);
      await db.execute(`
        insert into Dogs (owner_id, name, size) values ((select user_id from Users where username ='alice123'), 'Jorpda', 'large');
      `);
      await db.execute(`
        insert into WalkRequests (dog_id, requested_time, duration_minutes, location, status) values ((select dog_id from Dogs where name = 'Max' and owner_id = (select user_id from Users where username = 'alice123')), ' 2025-06-10 08:00:00', '30', 'Parklands', 'open');
      `);
      await db.execute(`
        insert into WalkRequests (dog_id, requested_time, duration_minutes, location, status) values ((select dog_id from Dogs where name = 'Bella' and owner_id = (select user_id from Users where username = 'carol123')), ' 2025-06-10 09:30:00', '45', 'Beachside Ave', 'accepted');
      `);
      await db.execute(`
        insert into WalkRequests (dog_id, requested_time, duration_minutes, location, status) values ((select dog_id from Dogs where name = 'Ruby' and owner_id = (select user_id from Users where username = 'kobi123')), ' 2025-06-10 18:00:00', '100', 'Hyrule', 'open');
      `);
      await db.execute(`
        insert into WalkRequests (dog_id, requested_time, duration_minutes, location, status) values ((select dog_id from Dogs where name = 'Hunter' and owner_id = (select user_id from Users where username = 'kobi123')), ' 2025-06-10 20:00:00', '60', 'Torna', 'open');
      `);
      await db.execute(`
        insert into WalkRequests (dog_id, requested_time, duration_minutes, location, status) values ((select dog_id from Dogs where name = 'Jorpda' and owner_id = (select user_id from Users where username = 'alice123')), ' 2025-06-10 23:30:00', '30', 'Pelican Town', 'accepted');
      `);
    }
  } catch (err) {
    console.error('Error setting up database. Ensure Mysql is running: service mysql start', err);
  }
})();

// added the specific labels that were used in the examples
app.get('/api/dogs', async (req, res) => {
  try {
    const [dogs] = await db.execute('select name as dog_name, size, Users.username as owner_username from Dogs join Users on Dogs.owner_id = Users.user_id');
    res.json(dogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [walkReqs] = await db.execute('select request_id, Dogs.name as dog_name, requested_time, duration_minutes, location, Users.username as owner_username from WalkRequests join Dogs on WalkRequests.dog_id = Dogs.dog_id join Users on Dogs.owner_id = Users.user_id');
    res.json(walkReqs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

// Hope I did this right testing was a bit of an asshole
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [walkers] = await db.execute(`select Users.username as walker_username, count(WalkRatings.rating_id) as total_ratings, round(avg(WalkRatings.rating), 1) as average_rating, count(WalkRequests.request_id) as completed_walks from Users left join WalkRatings on Users.user_id = WalkRatings.walker_id left join WalkRequests on WalkRequests.request_id = WalkRatings.request_id where Users.role = 'walker' group by Users.user_id`);
    res.json(walkers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walkers' });
  }
}); 

app.get('/index', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
}); 

app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;