const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const axios = require('axios'); // for reCAPTCHA

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const mongoUrl = 'mongodb+srv://refat:refat97113@cluster0.q42r8kx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoUrl)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  }
}));

// Replace with your Google reCAPTCHA secret key
const RECAPTCHA_SECRET_KEY = '6Lcj8ZcrAAAAABfPOY2wVSslZwwI2TXG16ak7r1N';

// User Schema
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String
}));

// Message Schema
const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
}));

// Session route to get current logged-in user
app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ username: req.session.user });
  } else {
    res.json({ username: null });
  }
});

// Register route with reCAPTCHA
app.post('/api/register', async (req, res) => {
  const { username, password, token } = req.body;

  // Validate reCAPTCHA token with Google
  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET_KEY,
          response: token,
        },
      }
    );

    if (!response.data.success) {
      return res.status(400).send('CAPTCHA verification failed');
    }
  } catch (err) {
    return res.status(500).send('Error verifying CAPTCHA');
  }

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).send('User already exists');

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.sendStatus(200);
});

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).send('Invalid credentials');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).send('Invalid credentials');

  req.session.user = user.username;
  res.sendStatus(200);
});

// Logout route
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.sendStatus(200);
});

// Fetch messages
app.get('/api/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 });
  res.json(messages);
});

// Socket.io chat message handling
io.on('connection', (socket) => {
  console.log('🟢 A user connected');

  socket.on('chat message', async ({ sender, content }) => {
    const message = await Message.create({ sender, content });
    io.emit('chat message', message);
  });

  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected');
  });

  socket.on('typing', (user) => {
    socket.broadcast.emit('typing', user);
  });

  socket.on('stop typing', (user) => {
    socket.broadcast.emit('stop typing', user);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
