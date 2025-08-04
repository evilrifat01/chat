const usersList = document.getElementById('users-list');

const logout = () => {
  fetch('/api/logout').then(() => (window.location.href = '/login.html'));
};

const refreshUsers = async () => {
  const users = await fetch('/api/pending-users').then(r => r.json());
  usersList.innerHTML = '';

  if (!users.length) {
    usersList.textContent = 'No users awaiting approval.';
    return;
  }

  users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <p><strong>${user.username}</strong></p>
      <button class="approve-btn">Approve</button>
      <button class="delete-btn">Delete</button>
    `;

    card.querySelector('.approve-btn').onclick = async () => {
      const res = await fetch(`/api/approve-user/${user._id}`, { method: 'PUT' });
      if (res.ok) {
        window.location.href = '/chat.html';
      } else {
        alert('Approval failed');
      }
    };

    card.querySelector('.delete-btn').onclick = async () => {
      const res = await fetch(`/api/delete-user/${user._id}`, { method: 'DELETE' });
      if (res.ok) {
        refreshUsers();
      } else {
        alert('Delete failed');
      }
    };

    usersList.appendChild(card);
  });
};

refreshUsers();
