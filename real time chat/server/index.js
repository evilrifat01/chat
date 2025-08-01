const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.json());
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.get('/api/status', (req, res) => {
  res.send('Server is running');
});

io.on('connection', (socket) => {
  console.log(`🟢 New client connected: ${socket.id}`);

  socket.on('chat message', (msg) => {
    // msg = { username: 'Alice', text: 'Hello!' }
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
