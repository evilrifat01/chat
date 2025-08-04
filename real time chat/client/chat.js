const socket = io();
const msgInput = document.getElementById('msg');
const chatWindow = document.getElementById('chat-window');
const typingStatus = document.getElementById('typing-status');

const logout = () => {
  fetch('/api/logout').then(() => (window.location.href = '/login.html'));
};

const sendMessage = () => {
  const content = msgInput.value;
  if (!content) return;
  socket.emit('chat message', { sender: 'Anonymous', receiver: null, content });
  msgInput.value = '';
};

msgInput.addEventListener('input', () => {
  socket.emit('typing', 'Anonymous');
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => socket.emit('stop typing', 'Anonymous'), 1000);
});

socket.on('chat message', msg => {
  const div = document.createElement('div');
  div.textContent = `${msg.sender}: ${msg.content}`;
  chatWindow.appendChild(div);
});

socket.on('typing', user => typingStatus.textContent = `${user} is typing...`);
socket.on('stop typing', () => typingStatus.textContent = '');
