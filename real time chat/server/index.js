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

// === MongoDB Connection ===
mongoose.connect('mongodb+srv://refat:refat97113@cluster0.q42r8kx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// === Middleware ===
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// === MongoDB Schemas ===
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  receiver: String, // for private messaging (optional)
  content: String,
  timestamp: { type: Date, default: Date.now }
}));

// === Session Route ===
app.get('/api/session', (req, res) => {
  if (req.session?.user) {
    res.json({ username: req.session.user });
  } else {
    res.json({ username: null });
  }
});

// === Auth Routes ===
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (await User.findOne({ username })) return res.status(400).send('User already exists');
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.sendStatus(200);
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).send('Invalid credentials');
  req.session.user = user.username;
  res.sendStatus(200);
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.sendStatus(200);
});

// === Message Fetch ===
app.get('/api/messages', async (req, res) => {
  const messages = await Message.find({ receiver: null }).sort({ timestamp: 1 }); // Public messages only
  res.json(messages);
});

// === Online Users Management ===
let onlineUsers = {}; // { username: socket.id }

io.on('connection', (socket) => {
  let currentUser = null;

  // When user joins
  socket.on('join', (username) => {
    currentUser = username;
    onlineUsers[username] = socket.id;
    io.emit('online users', Object.keys(onlineUsers));
    console.log(`🟢 ${username} joined`);
  });

  // Public chat message
  socket.on('chat message', async ({ sender, content }) => {
    const message = await Message.create({ sender, content });
    io.emit('chat message', message);
  });

  // Private message
  socket.on('private message', async ({ sender, receiver, content }) => {
    const message = await Message.create({ sender, receiver, content });
    const receiverSocket = onlineUsers[receiver];
    if (receiverSocket) {
      io.to(receiverSocket).emit('private message', message);
    }
    socket.emit('private message', message); // Show to sender as well
  });

  // Typing indicators
  socket.on('typing', (user) => {
    socket.broadcast.emit('typing', user);
  });
  socket.on('stop typing', (user) => {
    socket.broadcast.emit('stop typing', user);
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('online users', Object.keys(onlineUsers));
      console.log(`🔴 ${currentUser} left`);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
