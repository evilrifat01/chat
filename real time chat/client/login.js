document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = e.target.username.value;
  const password = e.target.password.value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    const session = await fetch('/api/session').then(r => r.json());
    window.location.href = session.isAdmin ? '/admin.html' : '/chat.html';
  } else {
    document.getElementById('login-status').textContent = await res.text();
  }
});
