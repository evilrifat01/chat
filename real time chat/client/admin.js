const usersList = document.getElementById('users-list');

const logout = () => {
  fetch('/api/logout').then(() => (window.location.href = '/login.html'));
};

const refreshUsers = async () => {
  const users = await fetch('/api/pending-users').then(r => r.json());
  usersList.innerHTML = '';

  users.forEach(user => {
    const div = document.createElement('div');
    div.textContent = user.username;

    const approveBtn = document.createElement('button');
    approveBtn.textContent = 'Approve';
    approveBtn.onclick = async () => {
      const res = await fetch(`/api/approve-user/${user._id}`, { method: 'PUT' });
      if (res.ok) {
        // Redirect to chat page after successful approval
        window.location.href = '/chat.html';
      } else {
        const data = await res.json();
        alert(data.message || 'Approval failed');
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async () => {
      await fetch(`/api/delete-user/${user._id}`, { method: 'DELETE' });
      refreshUsers();
    };

    div.appendChild(approveBtn);
    div.appendChild(deleteBtn);
    usersList.appendChild(div);
  });
};

refreshUsers();
