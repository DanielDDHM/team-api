import socketIO from 'socket.io';

import User from '../models/user';
import Staff from '../models/staff';
import Psychologist from '../models/psychologist';

let io = null;

class Socket {
	setConnection(httpsServer) {
		const path = `${process.env.API_URL || '/api'}/socket`;
		io = socketIO(httpsServer, {
			allowEIO3: true,
			path,
			serveClient: true,
			pingTimeout: 30000,
			cors: {
				origin: '*',
				credentials: true,
			},
		});

		console.log('SOCKET CONNECTED!!!!');
        
		io.on('connection', (socket) => {
			const { handshake } = socket;
			const { query } = handshake;
			console.log('----- USER CONNECTED -----', query);
			const source = query.source;

			if (source === 'psyc') this.updatePsychologist(query.user, true, socket);

			socket.on('disconnect', async () => {
				console.log('a user disconnected');
				if (source === 'psyc') {
					this.updatePsychologist(query.user, false, socket);
					this.disconnectFromChat(socket, null, source);
				} else this.disconnectFromChat(socket, null, source);
			});

			// CHATS
			socket.on('chat', (chatId) => {
				console.log('chat enter', chatId);
				this.connectToChat(socket, chatId, source);
			});

			socket.on('chat-leave', (chatId) => {
				console.log('chat leave', chatId);
				this.disconnectFromChat(socket, chatId, source);
			});
		});
	}
    
	// CHATS
	async connectToChat(socket, chatId, app) {

		if (!chatId) return;

		socket.join(chatId);

	}

	async disconnectFromChat(socket, chatId, app) {
		if (chatId) {
			socket.leave(chatId);
			if (app != 'app') {
				console.log('HERE: ');
			} else {
				console.log('HERE: ');
			}
			return;
		}

		if (app != 'app') {
			console.log('HERE: ');
		} else {
			console.log('HERE: ');
		}
	}
    
	async updatePsychologist(psychologistId, connected, socket) {
		try {
			await Psychologist.findOneAndUpdate({ _id: psychologistId }, { connectedSocket: connected });
			if (connected) {
				socket.join('voice-call');
			} else socket.leave('voice-call');
		} catch (err) {
			console.log('error', psychologistId, err);
		}
	}
    
	// socket functions
	get io() {
		return io;
	}
    
	emit(room, params) {
		io.emit(String(room), params);
	}
    
	getRooms() {
		return io.sockets.adapter.rooms;
	}
    
	getRoom(room) {
		return io.sockets.adapter.rooms[room];
	}
}

const instance = new Socket();

export default instance;