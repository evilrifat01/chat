const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const mongoUrl = 'mongodb+srv://refat:refat97113@cluster0.q42r8kx.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(mongoUrl)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Replace with your reCAPTCHA secret
const RECAPTCHA_SECRET = '6Lcj8ZcrAAAAABfPOY2wVSslZwwI2TXG16ak7r1N';

// User schema with approval flag
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String,
  approved: { type: Boolean, default: false }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
}));

// Session info endpoint
app.get('/api/session', (req, res) => {
  res.json({ username: req.session.user || null });
});

// Register (with reCAPTCHA and pending approval)
app.post('/api/register', async (req, res) => {
  const { username, password, token } = req.body;
  if (!token) return res.status(400).send('CAPTCHA missing');
  const captcha = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
    params: { secret: RECAPTCHA_SECRET, response: token }
  });
  if (!captcha.data.success) return res.status(400).send('CAPTCHA failed');
  if (await User.findOne({ username })) return res.status(400).send('User exists');

  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, password: hash, approved: false });
  res.send('Registered. Wait for admin approval.');
});

// Login (only approved users)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).send('Invalid credentials');
  if (!user.approved) return res.status(403).send('Awaiting admin approval');
  if (!(await bcrypt.compare(password, user.password))) return res.status(401).send('Invalid credentials');
  req.session.user = username;
  res.sendStatus(200);
});

// Logout
app.get('/api/logout', (req, res) => req.session.destroy(() => res.sendStatus(200)));

// Fetch public messages
app.get('/api/messages', async (_, res) => {
  const msgs = await Message.find({ receiver: null }).sort({ timestamp: 1 });
  res.json(msgs);
});

// Admin endpoints (no auth; optionally protect later)
app.get('/api/admin/unapproved', async (_, res) => {
  const list = await User.find({ approved: false }, 'username');
  res.json(list);
});
app.post('/api/admin/approve', async (req, res) => {
  await User.updateOne({ username: req.body.username }, { approved: true });
  res.sendStatus(200);
});
app.post('/api/admin/delete', async (req, res) => {
  await User.deleteOne({ username: req.body.username });
  res.sendStatus(200);
});

// Socket.io simple real‑time public chat
io.on('connection', socket => {
  socket.on('chat message', async msg => {
    const m = await Message.create(msg);
    io.emit('chat message', m);
  });
  socket.on('typing', user => socket.broadcast.emit('typing', user));
  socket.on('stop typing', user => socket.broadcast.emit('stop typing', user));
});

// Auto-delete messages older than 1 hour every 10 minutes
setInterval(async () => {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const result = await Message.deleteMany({ timestamp: { $lt: cutoff } });
  if (result.deletedCount > 0) {
    console.log(`🗑 Deleted ${result.deletedCount} old messages`);
  }
}, 10 * 60 * 1000); // Run every 10 minutes


const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Listening on port ${PORT}`));

