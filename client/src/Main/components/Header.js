import React from 'react';

function Header({username, isOnline}) {
	return (
		<div className="header d-flex align-items-center pl-4">
      <i className="fa fa-user-circle icon-header" aria-hidden="true"></i>
			<div>
        <h4 className="mb-1">{username}</h4>
        <div className="d-flex align-items-center">
          <div className={`circle ${!isOnline ? 'offline' : ''}`} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>
		</div>
	);
}

export default Header;
