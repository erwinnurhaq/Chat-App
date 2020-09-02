import React, { useState, useEffect, useRef } from 'react';

import Header from './components/Header';
import UsersList from './components/UsersList';
import ChannelsList from './components/ChannelsList';

function Main() {
	const isComponentMounted = useRef(false);
	const socket = useRef(null);
	const socketHeartBeatTimeout = useRef(null);
	const socketPeriodicDisconnectTimeout = useRef(null);
	const socketReconnectTimeout = useRef(null);

	const [message, setMessage] = useState('');
	const [chats, setChats] = useState([]);
	const [selectedChannel, setSelectedChannel] = useState(1);
	const [isOnline, setIsOnline] = useState(false);
	const [currentUser, setCurrentUser] = useState({
		id: 0,
		name: '',
	});
	const [selectedUser, setSelectedUser] = useState(0);
	const [usersList, setUsersList] = useState({
		online: [],
		offline: [],
	});
	
	function selectedChannelChange(val) {
		setChats([])
		setSelectedUser(0);
		setSelectedChannel(val);
	}

	function selectedUserChange(val) {
		setChats([])
		setSelectedChannel(0);
		setSelectedUser(val);
	}

	function socketHeartBeat() {
		clearTimeout(socketHeartBeatTimeout.current);

		socketHeartBeatTimeout.current = setTimeout(() => {
			if (socket.current !== null && socket.current.close) {
				socket.current.close();
			}
		}, 10000 + 1000);
	}

	function socketPeriodicDisconnect() {
		clearTimeout(socketPeriodicDisconnectTimeout.current);

		socketPeriodicDisconnectTimeout.current = setTimeout(() => {
			if (socket.current !== null && socket.current.close) {
				socket.current.close();
			}
		}, 3600000);
	}

	function registerName(name) {
		socket.current.send(
			JSON.stringify({
				event: 'register',
				data: { name },
			})
		);
	}

	function connectSocket(name) {
		const ws = new WebSocket('ws://localhost:2000/ws');

		ws.onopen = () => {
			registerName(name);
			socketHeartBeat();
			socketPeriodicDisconnect();
			setIsOnline(true);
		};

		ws.onmessage = (message) => {
			const { event, data } = JSON.parse(message.data);
			switch (event) {
				case 'chat':
					console.log(data);
					return setChats(prev => [...prev, data]);
				case 'users_list':
					return setUsersList({
						online: data.usersList.filter((user) => user.status === 1),
						offline: data.usersList.filter((user) => user.status === 0),
					});
				case 'current_user':
					return setCurrentUser(data.currentUser);
				case 'ping':
					console.log('ping');
					socketHeartBeat();
					return ws.send(JSON.stringify({ event: 'pong' }));
				default:
					return;
			}
		};

		ws.onclose = (e) => {
			console.log(e);
			clearTimeout(socketHeartBeatTimeout.current);
			clearTimeout(socketPeriodicDisconnectTimeout.current);
			socket.current.onopen = null;
			socket.current.onmessage = null;
			socket.current.onclose = null;
			socket.current.onerror = null;
			socket.current = null;

			if (!isComponentMounted) return;

			setIsOnline(false);
			console.log(`Server closed. ${e.reason}.\nReconnecting in 10 seconds...`);

			socketReconnectTimeout.current = setTimeout(() => {
				if (!isComponentMounted) return;

				socket.current = connectSocket(name);
			}, 10000);
		};

		ws.onerror = (err) => {
			console.log(err);
			console.log(`Server error: ${err}. Closing...`);
			ws.close();
		};

		return ws;
	}

	function submitMessage(e) {
		e.preventDefault();
		const target = selectedUser > 0 ? selectedUser : selectedChannel;
		const broadcast = selectedChannel > 0 ? true : false;
		const chat = {
			id: `${currentUser.name}_${Date.now()}`,
			message: message,
			userId: currentUser.id,
			username: currentUser.name,
		};
		setMessage('');
		setChats(prev => [...prev, chat])

		socket.current.send(
			JSON.stringify({
				event: 'chat',
				data: { target, broadcast, message: chat },
			})
		);
	}

	function initial() {
		const name = prompt('What is your name?');
		if (!name || name.trim().length === 0) return initial();
		socket.current = connectSocket(name);
	}

	useEffect(() => {
		isComponentMounted.current = true;
		initial();

		return () => {
			isComponentMounted.current = false;
			clearTimeout(socketHeartBeatTimeout.current);
			clearTimeout(socketPeriodicDisconnectTimeout.current);
			clearTimeout(socketReconnectTimeout.current);

			if (socket.current !== null && socket.current.close) {
				socket.current.close();
			}
		};
	}, []);

	function selectedChatInfo() {
		if (selectedUser > 0) {
			return usersList.online.find((user) => user.id === selectedUser).name;
		}
		return 'ALL';
	}

	return (
		<div className="container-fluid">
			<div className="row no-gutters">
				<div className="col-3 col-xxl-2 bg-dark text-white side-bar">
					<Header username={currentUser.name} isOnline={isOnline} />
					<div className="users-list p-4">
						<ChannelsList
							selectedChannel={selectedChannel}
							setSelectedChannel={selectedChannelChange}
						/>
						<UsersList
							usersList={usersList}
							selectedUser={selectedUser}
							setSelectedUser={selectedUserChange}
						/>
					</div>
				</div>
				<div className="col-9 col-xxl-10 chat-area">
					<div className="d-flex align-items-center pl-5 chat-info">
						<i
							className="fa fa-user-circle icon-header-chat"
							aria-hidden="true"
						></i>
						<h4 className="mb-1">{selectedChatInfo()}</h4>
					</div>
					<div className="d-flex flex-column chat-content">
						{chats.length > 0 &&
							chats.map((chat) => (
								<div
									key={`${chat.message}${chat.userId}`}
									className={`chat-box ${
										chat.userId === currentUser.id ? 'me' : ''
									}`}
								>
									{chat.userId !== currentUser.id && <h5>{chat.username}</h5>}
									<p>{chat.message}</p>
								</div>
							))}
					</div>
					<form
						className="d-flex justify-content-center align-items-center pl-4 pr-4 chat-input"
						onSubmit={submitMessage}
					>
						<input
							className="form-control"
							type="text"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Message (enter to send)"
						/>
					</form>
				</div>
			</div>
		</div>
	);
}

export default Main;
