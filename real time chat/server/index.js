require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const {
  MONGO_URL,
  SESSION_SECRET,
  RECAPTCHA_SECRET,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  PORT
} = process.env;

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URL }),
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  approved: { type: Boolean, default: false }
});
const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Session Info
app.get('/api/session', (req, res) => {
  res.json({
    user: req.session.user || null,
    isAdmin: req.session.isAdmin || false,
    isApproved: req.session.isAdmin || req.session.approved || false
  });
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, token } = req.body;
    if (!token) return res.status(400).send('Captcha token missing');

    const verify = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: RECAPTCHA_SECRET, response: token }
    });
    if (!verify.data.success) return res.status(400).send('Captcha failed');
    if (await User.findOne({ username })) return res.status(400).send('Username exists');

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed });
    res.send('Registration successful, awaiting approval');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      req.session.user = ADMIN_USERNAME;
      return res.sendStatus(200);
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).send('Invalid credentials');
    if (!user.approved) return res.status(403).send('Awaiting admin approval');
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).send('Invalid credentials');

    req.session.user = username;
    req.session.approved = true;
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Logout
app.get('/api/logout', (req, res) => {
  req.session.destroy(() => res.sendStatus(200));
});

// Admin APIs
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.status(403).send('Admin only');
};

app.get('/api/pending-users', isAdmin, async (req, res) => {
  const users = await User.find({ approved: false }, 'username _id');
  res.json(users);
});

app.put('/api/approve-user/:id', isAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { approved: true });
  res.sendStatus(200);
});

app.delete('/api/delete-user/:id', isAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.sendStatus(200);
});

// Messages
app.get('/api/messages', async (req, res) => {
  const msgs = await Message.find({ receiver: null }).sort({ timestamp: 1 });
  res.json(msgs);
});

// Socket.IO
io.on('connection', socket => {
  socket.on('chat message', async msg => {
    const saved = await Message.create(msg);
    io.emit('chat message', saved);
  });

  socket.on('typing', user => socket.broadcast.emit('typing', user));
  socket.on('stop typing', user => socket.broadcast.emit('stop typing', user));
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

