document.addEventListener('DOMContentLoaded', async () => {
  const userListContainer = document.getElementById('user-list');
  userListContainer.innerHTML = '<p>Loading users...</p>';

  try {
    const res = await fetch('/api/pending-users');
    const users = await res.json();
    userListContainer.innerHTML = '';

    if (users.length === 0) {
      userListContainer.innerHTML = '<p>No pending approvals.</p>';
      return;
    }

    users.forEach(user => {
      const div = document.createElement('div');
      div.className = 'user-card';
      div.innerHTML = `
        <p><strong>Username:</strong> ${user.username}</p>
        <button onclick="approveUser('${user._id}')">Approve</button>
        <button onclick="deleteUser('${user._id}')">Delete</button>
      `;
      userListContainer.appendChild(div);
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    userListContainer.innerHTML = '<p>Failed to load users.</p>';
  }
});

async function approveUser(userId) {
  try {
    const res = await fetch('/api/approve-user/' + userId, {
      method: 'PUT'
    });

    if (res.ok) {
      alert('User approved!');
      location.reload();
    } else {
      const data = await res.json();
      alert('Approval failed: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error approving user:', err);
    alert('Something went wrong during approval.');
  }
}

async function deleteUser(userId) {
  try {
    const res = await fetch('/api/delete-user/' + userId, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('User deleted!');
      location.reload();
    } else {
      const data = await res.json();
      alert('Delete failed: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    alert('Something went wrong during deletion.');
  }
}
