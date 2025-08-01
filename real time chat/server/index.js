const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Setup sessions
app.use(session({
  secret: 'your-secret-key', // CHANGE THIS in production
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }, // secure:true if using HTTPS
}));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../client')));

// MongoDB User schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
});

const User = mongoose.model('User', userSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Registration route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).send('Missing username or password');

  try {
    const exists = await User.findOne({ username });
    if(exists) return res.status(400).send('Username taken');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash });
    await user.save();

    req.session.userId = user._id;
    req.session.username = user.username;

    res.status(201).send('Registered and logged in');
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).send('Missing username or password');

  try {
    const user = await User.findOne({ username });
    if(!user) return res.status(400).send('Invalid username or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if(!valid) return res.status(400).send('Invalid username or password');

    req.session.userId = user._id;
    req.session.username = user.username;

    res.send('Logged in');
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.send('Logged out');
  });
});

// Middleware to check auth for Socket.IO
io.use((socket, next) => {
  const cookie = socket.request.headers.cookie;
  // Very simple session parse for demo; for production use better parsing or shared session store
  if (cookie && cookie.includes('connect.sid')) {
    next();
  } else {
    next(new Error("Not authenticated"));
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  const req = socket.request;
  // For demo, no real session retrieval from cookie, you can improve this with a shared session store

  console.log(`🟢 New client connected: ${socket.id}`);

  socket.on('chat message', (msg) => {
    // msg should include username and text
    if (!msg.username) return; // simple auth check
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
