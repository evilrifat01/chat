document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = e.target.username.value;
  const password = e.target.password.value;
  const token = grecaptcha.getResponse();

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, token })
  });

  document.getElementById('register-status').textContent = await res.text();
});
