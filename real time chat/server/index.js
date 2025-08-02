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

// Replace with your actual URI & keys
const MONGO_URL = 'your-mongo-uri';
const RECAPTCHA_SECRET = 'your-recaptcha-secret';
const ADMIN_USERNAME = 'admin';        // simple admin login
const ADMIN_PASSWORD = 'adminpass';

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));
app.use(session({
  secret: 'very-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URL }),
  cookie: { maxAge: 86400000 }
}));

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  approved: { type: Boolean, default: false },
});
const User = mongoose.model('User', userSchema);

const msgSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', msgSchema);

// Session
app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null, isAdmin: req.session.isAdmin || false });
});

// Register
app.post('/api/register', async (req, res) => {
  const { username, password, token } = req.body;
  if (!token) return res.status(400).send('CAPTCHA missing');
  try {
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: RECAPTCHA_SECRET, response: token }
    });
    if (!data.success) return res.status(400).send('CAPTCHA failed');
  } catch {
    return res.status(500).send('CAPTCHA verification error');
  }
  if (await User.findOne({ username })) return res.status(400).send('Username taken');
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, password: hash });
  res.send('Registered — pending approval');
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.user = ADMIN_USERNAME;
    return res.sendStatus(200);
  }
  const user = await User.findOne({ username });
  if (!user) return res.status(401).send('Invalid credentials');
  if (!user.approved) return res.status(403).send('Awaiting admin approval');
  if (!await bcrypt.compare(password, user.password)) return res.status(401).send('Invalid credentials');
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

// Admin middleware
function isAdmin(req, res, next) {
  req.session.isAdmin ? next() : res.status(403).send('Admin only');
}

// Admin routes
app.get('/api/admin/unapproved', isAdmin, async (_, res) => {
  const users = await User.find({ approved: false }, 'username');
  res.json(users);
});
app.post('/api/admin/approve', isAdmin, async (req, res) => {
  await User.updateOne({ username: req.body.username }, { approved: true });
  res.sendStatus(200);
});
app.post('/api/admin/delete', isAdmin, async (req, res) => {
  await User.deleteOne({ username: req.body.username });
  res.sendStatus(200);
});

// Auto-delete messages older than 1 hour
setInterval(async () => {
  const cutoff = new Date(Date.now() - 3600000);
  const result = await Message.deleteMany({ timestamp: { $lt: cutoff } });
  if (result.deletedCount) console.log(`🗑 Deleted ${result.deletedCount} messages`);
}, 600000);

io.on('connection', (socket) => {
  console.log('🟢 Socket connected');
  socket.on('chat message', async m => {
    await Message.create(m);
    io.emit('chat message', m);
  });
  socket.on('typing', u => socket.broadcast.emit('typing', u));
  socket.on('stop typing', u => socket.broadcast.emit('stop typing', u));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Listening on ${PORT}`));
