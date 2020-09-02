const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const WebSocket = require('ws');
const db = require('./config/database');
const util = require('util');
const moment = require('moment');
const dbquery = util.promisify(db.query).bind(db);

const port = process.env.PORT || 2000;
const app = express();
const currentTime = () => moment().utc().format('YYYY-MM-DD hh:mm:ss');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
	res.status(200).send({ message: 'server on', status: 200 });
});

app.post('/users', async (req, res) => {
	try {
		const check = await dbquery(`SELECT * FROM users WHERE name=?`, [
			req.body.name,
		]);

		if (check.length > 0) {
			const date = currentTime();
			const update = await dbquery(`UPDATE users SET ? WHERE id = ?`, [
				{
					status: 1,
					updated_at: date,
				},
				check[0].id,
			]);
			console.log(update);

			return res.status(200).send({
				user: {
					...check[0],
					status: 1,
					updated_at: date,
				},
			});
		}

		const insert = await dbquery(`INSERT INTO users SET ?`, {
			name: req.body.name,
			status: 1,
			created_at: currentTime(),
		});

		const user = await dbquery(`SELECT * FROM users WHERE id=?`, [
			insert.insertId,
		]);

		await dbquery(`INSERT INTO channel_users SET ?`, {
			channel_id: 1,
			user_id: insert.insertId,
		});

		res.status(200).send({ user: user[0] });
	} catch (err) {
		res.status(500).send(err);
	}
});

app.get('/channelchats/:channel_id', async (req, res) => {
	try {
		const channelId = Number(req.params.channel_id);
		if (!channelId) {
			return res.status(400).send({ message: 'Please provide channel id' });
		}
		const chats = await dbquery(
			`
			SELECT mc.id, mc.user_id, mc.message, mc.created_at, u.name as username
			FROM message_channels mc JOIN users u ON mc.user_id = u.id
			WHERE channel_id=1 ORDER BY mc.created_at
		`,
			[channelId]
		);
		res.status(200).send({ chats });
	} catch (err) {
		res.status(500).send(err);
	}
});

app.get('/userchats', async (req, res) => {
	try {
		const user1 = Number(req.query.user_id_1);
		const user2 = Number(req.query.user_id_2);
		if (!user1 || !user2) {
			return res.status(400).send({ message: 'Please provide user id' });
		}
		const chats = await dbquery(
			`
			SELECT mu.id, mu.user_id_1 as user_id, mu.message, mu.created_at, u.name as username
			FROM message_users mu JOIN users u
			ON mu.user_id_1 = u.id
			WHERE (user_id_1=? AND user_id_2=?) OR (user_id_1=? AND user_id_2=?)
		`,
			[user1, user2, user2, user1]
		);
		res.status(200).send({ chats });
	} catch (err) {
		res.status(500).send(err);
	}
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

let pingpongInterval = null;

async function chatHandler(currentSocket, data) {
	try {
		const { target, broadcast, message } = data;
		let chat, channelUsers, insert;

		if (broadcast) {
			chat = {
				channel_id: target,
				user_id: currentSocket.user.id,
				message,
				created_at: currentTime(),
			};
			insert = await dbquery(`INSERT INTO message_channels SET ?`, chat);
			channelUsers = await dbquery(
				`SELECT * FROM channel_users WHERE channel_id = ?`,
				[target]
			);
			return wss.clients.forEach((socket) => {
				if (
					socket.readyState === WebSocket.OPEN &&
					socket !== currentSocket &&
					channelUsers
						.map((channel) => channel.user_id)
						.includes(socket.user.id)
				) {
					socket.send(
						JSON.stringify({
							event: 'chat',
							data: {
								...chat,
								username: currentSocket.user.name,
								id: insert.insertId,
							},
						})
					);
				}
			});
		}

		return wss.clients.forEach(async (socket) => {
			if (socket.user.id === target) {
				chat = {
					message,
					created_at: currentTime(),
				};
				insert = await dbquery(`INSERT INTO message_users SET ?`, {
					user_id_1: currentSocket.user.id,
					user_id_2: socket.user.id,
					...chat,
				});
				socket.send(
					JSON.stringify({
						event: 'chat',
						data: {
							id: insert.insertId,
							user_id: currentSocket.user.id,
							user_id_2: socket.user.id,
							username: currentSocket.user.name,
							...chat,
						},
					})
				);
			}
		});
	} catch (err) {
		console.log(err);
	}
}

async function broadcastUsersList() {
	try {
		const users = await dbquery(`SELECT * FROM users`);
		wss.clients.forEach((socket) => {
			if (socket.readyState === WebSocket.OPEN) {
				const list = users.filter((user) => user.id !== socket.user.id);
				socket.send(
					JSON.stringify({
						event: 'users_list',
						data: list,
					})
				);
			}
		});
	} catch (err) {
		console.log(err);
	}
}

async function userDisconnect(socket) {
	try {
		const update = await dbquery(`UPDATE users SET ? WHERE id = ?`, [
			{
				status: 0,
				updated_at: currentTime(),
			},
			socket.user.id,
		]);
		console.log(update);
		socket.terminate();
		console.log(`user ${socket.user.name} is disconnected`);
		broadcastUsersList();
	} catch (err) {
		console.log(err);
	}
}

function userJoin(socket, user) {
	socket.user = user;
	console.log(`user ${socket.user.name} is connected`);
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
			case 'join':
				return userJoin(socket, data);
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
