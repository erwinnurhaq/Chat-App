import React from 'react';

function UsersList({ usersList, selectedUser, setSelectedUser }) {
	const { online, offline } = usersList;
	return (
		<div>
			<h4 className="pb-2">Friends</h4>
			<div>
				<p>Online: ({online.length})</p>
				<ul>
					{online.length > 0 &&
						online.map((user) => (
              <li
                className={`d-flex align-items-center ${selectedUser === user.id ? 'selected' : ''}`}
                key={user.id}
                onClick={() => setSelectedUser(user.id)}
              >
                <i className="fa fa-user-circle icon-user-list" aria-hidden="true" />{user.name}
              </li>
            ))}
				</ul>
			</div>
			<div>
				<p>Offline: ({offline.length})</p>
				<ul>
					{offline.length > 0 &&
						offline.map((user) => (
              <li
                className={`d-flex align-items-center ${selectedUser === user.id ? 'selected' : ''}`}
                key={user.id}
              >
                <i className="fa fa-user-circle icon-user-list offline" aria-hidden="true" />{user.name}
              </li>
            ))}
				</ul>
			</div>
		</div>
	);
}

export default UsersList;
