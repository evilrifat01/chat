// index.js (backend)
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Allow CORS
app.use(cors({
  origin: '*', // Replace with your frontend URL in production
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// User model
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String,
}));

// Chat message model
const Message = mongoose.model('Message', new mongoose.Schema({
  user: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.json({ success: true });
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user.username;
    res.json({ success: true, username: user.username });
  } else {
    res.json({ success: false });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', async (socket) => {
  console.log('🟢 User connected');

  const messages = await Message.find().sort({ timestamp: 1 });
  socket.emit('chat history', messages);

  socket.on('chat message', async ({ user, text }) => {
    const msg = await Message.create({ user, text });
    io.emit('chat message', msg);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
