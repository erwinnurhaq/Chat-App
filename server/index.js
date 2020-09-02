const http = require('http');
const express = require('express');
const dotenv = require('dotenv').config()
const WebSocket = require('ws');
// const db = require('./config/database')
// const util = require('util')
// const dbquery = util.promisify(db.query).bind(db)

const port = process.env.PORT || 2000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.get('/', (req, res) => {
	res.status(200).send({ message: 'server on', status: 200 });
});

// app.get('/users', async (req, res) => {
// 	try {
// 		const users = await dbquery(`SELECT * FROM users`)
// 		res.status(200).send(users)
// 	} catch (error) {
// 		res.status(500).send(error)
// 	}
// })

const usersList = [];
let pingpongInterval = null;

function generateId() {
	if (usersList.length === 0) return 1;
	return usersList.map((user) => user.id).sort((a, b) => b - a)[0] + 1;
}

function chatHandler(currentSocket, data) {
	const { target, broadcast, message } = data;
	if (broadcast) {
		return wss.clients.forEach((socket) => {
			if (socket.readyState === WebSocket.OPEN && socket !== currentSocket) {
				socket.send(
					JSON.stringify({
						event: 'chat',
						data: message,
					})
				);
			}
		});
	}
	const targetSocket = wss.clients.find((socket) => socket.user.id === target);
	targetSocket.send(
		JSON.stringify({
			event: 'chat',
			data: message,
		})
	);
}

function broadcastUsersList() {
	wss.clients.forEach((socket) => {
		if (socket.readyState === WebSocket.OPEN) {
			const list = usersList.filter((user) => user.id !== socket.user.id);
			socket.send(
				JSON.stringify({
					event: 'users_list',
					data: { usersList: list },
				})
			);
		}
	});
}

function userDisconnect(socket) {
	if (socket.user) {
		const index = usersList.findIndex((user) => user.id === socket.user.id);
		usersList.splice(index, 1, {
			...usersList[index],
			status: 0,
		});
	}
	socket.terminate();
	console.log(`user ${socket.user.name} is disconnected`);
	broadcastUsersList();
}

function userRegister(socket, data) {
	const name = new RegExp(data.name, 'i');
	const index = usersList.findIndex((user) => user.name.match(name));
	let user;
	// WILL ADD USERNAME IF NAME IS NOT LISTED
	// WILL MAKE STATUS ONLINE IF NAME IS ALREADY LISTED
	if (index >= 0) {
		user = { ...usersList[index], status: 1 };
		usersList.splice(index, 1, user);
	} else {
		user = {
			id: generateId(),
			name: data.name,
			status: 1,
		};
		usersList.push(user);
	}
	socket.user = user;
	console.log(`user ${socket.user.name} is connected`);
	socket.send(
		JSON.stringify({ event: 'current_user', data: { currentUser: user } })
	);
	broadcastUsersList();
}

function setPingPongInterval() {
	pingpongInterval = setInterval(() => {
		wss.clients.forEach((socket) => {
			if (socket.isAlive === false) {
				return userDisconnect(socket);
			}
			socket.isAlive === false;
			socket.send(JSON.stringify({ event: 'ping' }));
		});
	}, 10000);
}

wss.on('connection', (socket) => {
	socket.isAlive = true;

	socket.on('message', (message) => {
		const { event, data } = JSON.parse(message);
		switch (event) {
			case 'pong':
				console.log('pong');
				return (socket.isAlive = true);
			case 'register':
				return userRegister(socket, data);
			case 'chat':
				return chatHandler(socket, data);
			default:
				return;
		}
	});

	socket.on('error', () => {
		console.log(`${socket.user.name}'s socket is error`);
		userDisconnect(socket);
	});

	socket.on('close', () => {
		console.log(`${socket.user.name}'s socket is closed`);
		userDisconnect(socket);
	});
});

wss.on('close', () => {
	clearInterval(pingPongInterval);
	console.log('Server Closed');
});

setPingPongInterval();

server.listen(port, () => console.log(`listening to port ${port}`));
