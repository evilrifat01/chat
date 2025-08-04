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
      await fetch(`/api/approve-user/${user._id}`, { method: 'PUT' });
      refreshUsers();
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
