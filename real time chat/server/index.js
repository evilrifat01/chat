const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect('mongodb://127.0.0.1:27017/chat-app')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

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

// Register route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
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

// Logout
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.sendStatus(200);
});

// Messages fetch
app.get('/api/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 });
  res.json(messages);
});

// WebSocket (Socket.io) chat handling
io.on('connection', (socket) => {
  console.log('🟢 A user connected');

  socket.on('chat message', async ({ sender, content }) => {
    const message = await Message.create({ sender, content });
    io.emit('chat message', message); // broadcast
  });

  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
