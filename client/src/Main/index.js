import React, { useState, useEffect, useRef } from 'react';
import moment from 'moment';

import Header from './components/Header';
import UsersList from './components/UsersList';
import ChannelsList from './components/ChannelsList';

function Main() {
	const isComponentMounted = useRef(false);
	const socket = useRef(null);
	const socketHeartBeatTimeout = useRef(null);
	const socketPeriodicDisconnectTimeout = useRef(null);
	const socketReconnectTimeout = useRef(null);
	const selectedUserRef = useRef(0)

	const [message, setMessage] = useState('');
	const [chats, setChats] = useState([]);
	const [selectedChannel, setSelectedChannel] = useState(1);
	const [isOnline, setIsOnline] = useState(false);
	const [currentUser, setCurrentUser] = useState(null);
	const [selectedUser, setSelectedUser] = useState(0);
	const [usersList, setUsersList] = useState({
		online: [],
		offline: [],
	});

	async function selectedChannelChange(val) {
		try {
			setSelectedUser(0);
			selectedUserRef.current = 0;
			setSelectedChannel(val);
			const result = await fetch(`http://localhost:2000/channelchats/${val}`);
			const { chats } = await result.json();
			setChats(chats);
		} catch (err) {
			console.error(err);
		}
	}

	async function selectedUserChange(val) {
		try {
			setSelectedChannel(0);
			setSelectedUser(val);
			selectedUserRef.current = val
			const result = await fetch(
				`http://localhost:2000/userchats?user_id_1=${currentUser.id}&user_id_2=${val}`
			);
			const { chats } = await result.json();
			setChats(chats);
		} catch (err) {
			console.error(err);
		}
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

	function userJoin(user) {
		socket.current.send(
			JSON.stringify({
				event: 'join',
				data: user,
			})
		);
	}

	function connectSocket(user) {
		const ws = new WebSocket('ws://localhost:2000/ws');

		ws.onopen = () => {
			userJoin(user);
			socketHeartBeat();
			socketPeriodicDisconnect();
			setIsOnline(true);
		};

		ws.onmessage = (message) => {
			const { event, data } = JSON.parse(message.data);
			switch (event) {
				case 'chat':
					console.log(data);
					console.log(data.user_id, data.user_id_2, user.id, selectedUserRef.current)
					// SINGLE
					if(data.user_id_2 && data.user_id_2 === user.id && data.user_id === selectedUserRef.current) {
						return setChats((prev) => [...prev, data]);
					}
					// BROADCAST
					if(data.user_id_2 === undefined && selectedUserRef.current === 0){
						return setChats((prev) => [...prev, data]);
					}
					break
				case 'users_list':
					return setUsersList({
						online:
							data.length > 0 ? data.filter((user) => user.status === 1) : [],
						offline:
							data.length > 0 ? data.filter((user) => user.status === 0) : [],
					});
				case 'ping':
					console.log('ping');
					socketHeartBeat();
					return ws.send(JSON.stringify({ event: 'pong' }));
				default:
					break;
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
			setUsersList((prev) => ({
				online: [],
				offline: [...prev.online, ...prev.offline],
			}));
			console.log(`Server closed. ${e.reason}.\nReconnecting in 10 seconds...`);

			socketReconnectTimeout.current = setTimeout(() => {
				if (!isComponentMounted) return;

				socket.current = connectSocket(user);
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

		setChats((prev) => [
			...prev,
			{
				id: `temp_${Date.now()}`,
				message: message,
				user_id: currentUser.id,
				username: currentUser.name,
			},
		]);

		socket.current.send(
			JSON.stringify({
				event: 'chat',
				data: { target, broadcast, message },
			})
		);
		setMessage('');
	}

	async function initial() {
		const name = prompt('What is your name?');
		if (!name || name.trim().length === 0) return initial();
		try {
			const result = await fetch('http://localhost:2000/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			});

			const { user } = await result.json();
			console.log(user);
			setCurrentUser(user);

			socket.current = connectSocket(user);

			const result2 = await fetch(
				`http://localhost:2000/channelchats/${selectedChannel}`
			);
			const { chats } = await result2.json();
			setChats(chats);
		} catch (err) {
			console.error(err);
			initial();
		}
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
		if ((selectedUser > 0) & (usersList.online.length > 0)) {
			return usersList.online.find((user) => user.id === selectedUser).name;
		}
		return 'ALL';
	}

	return (
		<div className="container-fluid">
			<div className="row no-gutters">
				<div className="col-3 col-xxl-2 bg-dark text-white side-bar">
					<Header username={currentUser?.name || ''} isOnline={isOnline} />
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
									key={chat.id}
									className={`chat-box ${
										Number(chat.user_id) === currentUser.id ? 'me' : ''
									}`}
								>
									{Number(chat.user_id) !== currentUser.id && (
										<h5>{chat.username}</h5>
									)}
									<p>{chat.message}</p>
									<p className="timestamp">
										{moment(chat.created_at)
											.locale('id')
											.format('DD/MM/YYYY hh:mm')}
									</p>
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
