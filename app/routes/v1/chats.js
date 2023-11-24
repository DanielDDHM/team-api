// Packages
import express from 'express';
import _ from 'lodash';
import { DateTime, Duration } from 'luxon';

// Utils
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { checkToken, checkRole } from './index';
import { mongoose } from '../../utils/database';
import messages from '../../utils/messages';
import config from '../../utils/config';
import Socket from '../../utils/socket';

// Models
import NotificationToken from '../../models/notificationToken';
import Chat from '../../models/chat';
import ChatMessage from '../../models/chatMessage';

const ObjectId = mongoose.Types.ObjectId;

const getChats = async (req) => {
	const { user, headers: { source } } = req;

	const chats = await Chat.aggregate([
		{ $match: { deleted: { $ne: true }, $or: [{ user: ObjectId(user._id) }, { psychologist: ObjectId(user._id) }] } },
		{ $lookup: {
			from: 'psychologists',
			let: { psychologistId: '$psychologist' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$psychologistId', '$_id'] } } },
				{ $addFields: { name: '$externalName' } },
				{ $project: { name: 1, photo: 1 } },
			],
			as: 'psychologist',
		} },
		{ $lookup: {
			from: 'users',
			let: { userId: '$user' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$userId', '$_id'] } } },
				{ $project: { name: 1, photo: 1 } },
			],
			as: 'user',
		} },
		{ $addFields: {
			psychologist: { $arrayElemAt: ['$psychologist', 0] },
			user: { $arrayElemAt: ['$user', 0] },
		} },
		{ $sort: { startDate: -1 } },
		{ $group: { _id: { _id: '$socketId', user: '$user', psychologist: '$psychologist' }, chats: { $push: '$$ROOT' } } },
		{ $replaceRoot: { newRoot: { $mergeObjects: ['$_id', '$$ROOT']  } } },
		{ $addFields: {
			_id: '$_id._id',
			startDate: { $arrayElemAt: ['$chats.startDate', 0] },
			finished: { $arrayElemAt: ['$chats.finished', 0] },
			lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
		} },
		{ $project: { chats: 0 } },
		{ $lookup: {
			from: 'chatmessages',
			let: { chatId: '$_id' },
			pipeline: [
				{ $match: { $expr: { $and: [{ $eq: ['$$chatId', '$socketId'] }, { $ne: ['$deleted', true] }] } } },
				{ $project: { sentBy: 1, message: 1, read: 1, _created: 1 } },
				{ $sort: { _created: -1 } },
				{ $limit: 1 },
			],
			as: 'lastMessage',
		} },
		{ $addFields: { lastMessage: { $arrayElemAt: ['$lastMessage', 0] } } },
		{ $sort: { 'lastMessage._created': -1, startDate: -1 } },
	]);

	return { code: 200, chats };
};

const getMessages = async (req) => {
	const { params: { id }, user, headers: { source } } = req;

	const messages = await ChatMessage.aggregate([
		{ $match: { deleted: { $ne: true }, socketId: id } },
		{ $addFields: { isUser: { $eq: ['$sentBy', 'user'] } } },
		{ $lookup: {
			from: 'psychologists',
			let: { psychologistId: '$psychologist' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$psychologistId', '$_id'] } } },
				{ $addFields: { name: '$externalName' } },
				{ $project: { name: 1, photo: 1 } },
			],
			as: 'psychologist',
		} },
		{ $lookup: {
			from: 'users',
			let: { userId: '$user' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$userId', '$_id'] } } },
				{ $project: { name: 1, photo: 1 } },
			],
			as: 'user',
		} },
		{ $addFields: { 
			psychologist: { $arrayElemAt: ['$psychologist', 0] },
			user: { $arrayElemAt: ['$user', 0] },
		} },
		{ $addFields: { user: { $cond: [{ $eq: ['$isUser', true] },'$user', '$psychologist'] } } },
		{
			$project: {
				_id: 1,
				text: '$message',
				createdAt: '$_created',
				user: {
					_id: '$user._id',
					name: '$user.name',
					avatar: { $ifNull: ['$user.photo', ''] },
				},
			},
		},
		{ $sort: source === 'app' ? { createdAt: -1 } :  { createdAt: 1 } },
	]);

	const updateRead = user.role === 'psychologist' ? { socketId: id, sentBy: 'user' } : { socketId: id, sentBy: 'psychologist' };
	await ChatMessage.updateMany(updateRead, { read: true });

	return { code: 200, messages };
};

const postMessage = async (req, res, next) => {
	const { params: { id }, user, body: { message } } = req;
	
	if (!message) throw errors.missing_fields;

	const chat = await Chat.findOne({ socketId: id, finished: false, $or: [{ user: user._id }, { psychologist: user._id }] }).lean();
	if (!chat) throw errors.chat_finished;

	const chatMessage = {
		chat: chat._id,
		user: chat.user,
		psychologist: chat.psychologist,
		message: message,
		sentBy: user.role,
		socketId: chat.socketId,
	};

	console.log('----------------------------------');
	console.log('---------- POST MESSAGE ----------', chatMessage);
	console.log('----------------------------------');
	
	await new ChatMessage(chatMessage).save();

	Socket.emit(`chat-${id}`, { update: true, message });

	return { code: 200 };
};

const patchStartChat = async (req) => {
	const { user, body: { message, psychologist } } = req;

	const existOpen = await Chat.findOne({ user: user._id, finished: false });
	console.log('EXISTE OPEN!!!!', existOpen);
	if (existOpen) throw errors.chat_opened;

	const startDate = DateTime.utc();
	const chat = new Chat({
		user: user._id,
		business: user.businessId,
		psychologist: psychologist || null,
		startDate: startDate.toJSDate(),
	});

	chat.socketId = psychologist ? `${String(user._id)}_${String(psychologist)}` : `${String(user._id)}_`;
    
	if (message) {
		const chatMessage = new ChatMessage({
			chat: chat._id,
			sentBy: 'user',
			user: user._id,
			psychologist: psychologist || null,
			message: message,
		});
    
		await Promise.all([
			chat.save(),
			chatMessage.save(),
		]);
	} else await chat.save();

	const emitChat = await Chat.findOne({ _id: chat._id }).populate('user psychologist').lean();

	Socket.emit('chat', { type: 'new-chat', record: emitChat });
    
	return { code: 200, chat: emitChat };
};

const patchAcceptChat = async (req) => {
	const { params: { id }, user } = req;

	const chat = await Chat.findOneAndUpdate({ _id: id, finished: false, $or: [{ psychologist: null }, { psychologist: user._id }] }, { psychologist: user._id, psychologistAccepted: true, psychologistAcceptedDate: DateTime.utc() }, { new: true }).lean();
	if (!chat) throw errors.chat_unavailable;
    
	const socketId = `${String(chat.user)}_${String(chat.psychologist)}`;

	const [ emitChat ] = await Promise.all([
		Chat.findOneAndUpdate({ _id: chat._id }, { socketId: socketId }, { new: true }).lean(),
		ChatMessage.updateMany({ chat: chat._id, psychologist: null }, { psychologist: user._id, socketId: socketId }),
	]);

	Socket.emit('chat', { type: 'accepted-chat', current: chat.socketId, record: emitChat.socketId });

	return { code: 200 };
};

const patchFinishChat = async (req) => {
	const { params: { id }, headers: { source }, user } = req;

	const query = source === 'psyc' ? { socketId: id, finished: false, psychologist: user._id } : { socketId: id, finished: false, user: user._id };

	const chat = await Chat.findOneAndUpdate(query, { finished: true }, { new: true }).lean();
	if (!chat) throw errors.chat_finished;

	if (!chat.psychologist) {
		await Promise.all([
			Chat.deleteOne({ _id: chat._id }),
			ChatMessage.deleteMany({ chat: chat._id }),
		]);
	}

	Socket.emit('chat', { type: 'finish-chat', record: chat.socketId });

	return { code: 200 };
};

const patchDeleteChat = async (req) => {
	const { params: { id }, headers: { source }, user } = req;

	const chat = await Chat.findOne({ socketId: id, finished: false, user: user._id }).lean();
	if (chat) throw errors.no_permission;

	await Promise.all([
		Chat.updateMany({ socketId: id }, { deleted: true }),
		ChatMessage.updateMany({ socketId: id }, { deleted: true }),
	]);

	Socket.emit('chat', { type: 'update-chat', record: id });

	return { code: 200 };
};

const patchReviewChat = async (req) => {
	const { params: { id }, headers: { source }, user, body: { rating } } = req;

	const chat = await Chat.findOne({ socketId: id, user: user._id }).sort({ startDate: -1 }).lean();
	if (!chat) throw errors.chat_unavailable_review;
    
	await Chat.updateOne({ _id: chat._id }, { rating });

	return { code: 200 };
};

//Router
const chatsRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { code, chats } = await getChats(req,res,next);
			response(req, res, code, 'CHAT_FOUND', 'Chat Found', { chats });
		}))
		.get('/:id', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { code, messages } = await getMessages(req,res,next);
			response(req, res, code, 'CHAT_FOUND', 'Chat Found', { messages });
		}))
		.post('/:id', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { code } = await postMessage(req,res,next);
			response(req, res, code, 'CHAT_FOUND', 'Chat Found');
		}))
		.patch('/start', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, chat } = await patchStartChat(req,res,next);
			response(req, res, code, 'START_CHAT', 'Chat Start', { chat });
		}))
		.patch('/accept/:id', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code } = await patchAcceptChat(req,res,next);
			response(req, res, code, 'CHAT_ACCEPTED', 'Chat Accepted');
		}))
		.patch('/finish/:id', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { code } = await patchFinishChat(req,res,next);
			response(req, res, code, 'CHAT_FINISHED', 'Chat Finished');
		}))
		.patch('/delete/:id', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code } = await patchDeleteChat(req,res,next);
			response(req, res, code, 'CHAT_DELETED', 'Chat Deleted');
		}))
		.patch('/review/:id', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code } = await patchReviewChat(req,res,next);
			response(req, res, code, 'CHAT_REVIEWED', 'Chat Reviewed');
		}));
	return router;
};

export const router = chatsRouter;