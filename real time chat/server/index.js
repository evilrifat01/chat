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

const MONGO_URL = process.env.MONGO_URL; // Set via env
const RECAPTCHA_SECRET = '6Lcj8ZcrAAAAABfPOY2wVSslZwwI2TXG16ak7r1N';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'adminpass';

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URL }),
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  approved: { type: Boolean, default: false }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
}));

// Session Info API
app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null, isAdmin: req.session.isAdmin || false });
});

// Register with recaptcha
app.post('/api/register', async (req, res) => {
  const { username, password, token } = req.body;
  if (!token) return res.status(400).send('Captcha is required');

  const verify = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
    params: { secret: RECAPTCHA_SECRET, response: token }
  });

  if (!verify.data.success) {
    return res.status(400).send('Captcha verification failed');
  }

  if (await User.findOne({ username })) {
    return res.status(400).send('Username already exists');
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.send('Registration successful. Await admin approval.');
});

// Login (user or admin)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.user = ADMIN_USERNAME;
    return res.sendStatus(200);
  }
  const user = await User.findOne({ username });
  if (!user) return res.status(401).send('Invalid credentials');
  if (!user.approved) return res.status(403).send('Awaiting approval');
  if (!await bcrypt.compare(password, user.password)) {
    return res.status(401).send('Invalid credentials');
  }
  req.session.user = username;
  res.sendStatus(200);
});

// Logout
app.get('/api/logout', (req, res) => req.session.destroy(() => res.sendStatus(200)));

// Public messages
app.get('/api/messages', async (_, res) => {
  const msgs = await Message.find({ receiver: null }).sort({ timestamp: 1 });
  res.json(msgs);
});

// Admin middleware
const isAdmin = (req,res,next) => req.session.isAdmin ? next() : res.status(403).send('Admin only');

// Pending user approval
app.get('/api/admin/unapproved', isAdmin, async (_, res) => {
  const list = await User.find({ approved: false }, 'username');
  res.json(list);
});

// Approve user
app.post('/api/admin/approve', isAdmin, async (req, res) => {
  await User.updateOne({ username: req.body.username }, { approved: true });
  res.sendStatus(200);
});

// Delete user
app.post('/api/admin/delete', isAdmin, async (req, res) => {
  await User.deleteOne({ username: req.body.username });
  res.sendStatus(200);
});

// Auto-delete 1h messages
setInterval(async () => {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const result = await Message.deleteMany({ timestamp: { $lt: cutoff } });
  if (result.deletedCount) console.log(`🗑️ Deleted ${result.deletedCount} old messages`);
}, 10 * 60 * 1000);

// Socket.IO handling
io.on('connection', socket => {
  socket.on('chat message', async msg => {
    await Message.create(msg);
    io.emit('chat message', msg);
  });
  socket.on('typing', u => socket.broadcast.emit('typing', u));
  socket.on('stop typing', u => socket.broadcast.emit('stop typing', u));
});

const PORT = process.env.PORT || 1000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
