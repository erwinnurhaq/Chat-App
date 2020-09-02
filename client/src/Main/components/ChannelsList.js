import React from 'react';

function ChannelsList({ selectedChannel, setSelectedChannel }) {
	return (
		<div>
			<h4 className="pb-2">Channel</h4>
			<div>
				<p>My Channel:</p>
				<ul>
					<li
						className={`d-flex align-items-center ${
							selectedChannel !== 0 ? 'selected' : ''
						}`}
						onClick={() => setSelectedChannel(1)}
					>
						<i className="fa fa-user-circle icon-user-list" aria-hidden="true" />
						ALL
					</li>
				</ul>
			</div>
		</div>
	);
}

export default ChannelsList;
