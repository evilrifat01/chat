const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB
mongoose.connect('mongodb+srv://refat:refat97113@cluster0.q42r8kx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

// Session with MongoStore for production-safe sessions
app.use(session({
  secret: 'secret-key',  // Change this to an environment variable in prod!
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb+srv://refat:refat97113@cluster0.q42r8kx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// User Schema
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
}));

// Message Schema
const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
}));

// Route: Get current logged-in user session
app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ username: req.session.user });
  } else {
    res.json({ username: null });
  }
});

// Route: Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed });
    res.sendStatus(200);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Route: Login user
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    req.session.user = user.username;
    res.sendStatus(200);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Route: Logout user
app.get('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.sendStatus(200);
  });
});

// Route: Fetch chat messages (sorted by timestamp ascending)
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.io: Real-time chat handling
io.on('connection', (socket) => {
  console.log('🟢 A user connected');

  socket.on('chat message', async ({ sender, content }) => {
    try {
      const message = await Message.create({ sender, content });
      io.emit('chat message', message);
    } catch (err) {
      console.error('Socket chat message error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected');
  });

  // Optional: typing indicators (implement in frontend if you want)
  socket.on('typing', (user) => {
    socket.broadcast.emit('typing', user);
  });

  socket.on('stop typing', (user) => {
    socket.broadcast.emit('stop typing', user);
  });
});

// 404 fallback route for unknown API endpoints
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
