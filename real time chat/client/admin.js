document.addEventListener('DOMContentLoaded', () => {
  const userListContainer = document.getElementById('user-list');

  // Fetch pending users
  fetch('/api/pending-users')
    .then(res => res.json())
    .then(users => {
      users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `
          <p><strong>Username:</strong> ${user.username}</p>
          <button onclick="approveUser('${user._id}')">Approve</button>
        `;
        userListContainer.appendChild(div);
      });
    })
    .catch(err => console.error('Error fetching users:', err));
});

function approveUser(userId) {
  fetch(`/api/approve-user/${userId}`, {
    method: 'PUT',
  })
    .then(res => {
      if (res.ok) {
        alert('User approved!');
        location.reload(); // Refresh the list
      } else {
        alert('Error approving user');
      }
    })
    .catch(err => console.error('Error approving user:', err));
}
