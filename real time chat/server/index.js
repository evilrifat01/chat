<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Real-time Chat</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    #chat { max-width: 600px; margin: 40px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    #messages { list-style-type: none; padding: 0; max-height: 300px; overflow-y: scroll; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px; }
    #messages li { padding: 8px; border-bottom: 1px solid #eee; }
    #messages li:last-child { border-bottom: none; }
    #form { display: flex; }
    #input { flex: 1; padding: 10px; font-size: 16px; border-radius: 4px 0 0 4px; border: 1px solid #ccc; border-right: none; }
    #send { padding: 10px 20px; background: #28a745; color: white; border: none; font-size: 16px; cursor: pointer; border-radius: 0 4px 4px 0; }
    #send:hover { background: #218838; }
    #logout { margin-top: 20px; text-align: center; }
    #logout button { padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="chat">
    <h2>Welcome to Chat Room</h2>
    <ul id="messages"></ul>
    <form id="form">
      <input id="input" autocomplete="off" placeholder="Type a message..." /><button id="send">Send</button>
    </form>
    <div id="logout">
      <button onclick="logout()">Logout</button>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let username = '';

    // Fetch session user
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        if (!data.username) {
          window.location.href = '/';
        } else {
          username = data.username;
          initChat();
        }
      })
      .catch(() => window.location.href = '/');

    function initChat() {
      const form = document.getElementById('form');
      const input = document.getElementById('input');
      const messages = document.getElementById('messages');

      // Load chat history
      fetch('/api/messages')
        .then(res => res.json())
        .then(data => {
          data.forEach(msg => {
            const item = document.createElement('li');
            item.textContent = `${msg.sender}: ${msg.content}`;
            messages.appendChild(item);
          });
          messages.scrollTop = messages.scrollHeight;
        });

      // Send message
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
          socket.emit('chat message', { sender: username, content: input.value });
          input.value = '';
        }
      });

      // Receive message
      socket.on('chat message', (msg) => {
        const item = document.createElement('li');
        item.textContent = `${msg.sender}: ${msg.content}`;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
      });
    }

    function logout() {
      fetch('/api/logout')
        .then(() => window.location.href = '/');
    }
  </script>
</body>
</html>
