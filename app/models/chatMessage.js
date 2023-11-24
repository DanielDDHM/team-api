import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const ChatMessageSchema = new Schema({
	chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
	sentBy: { type: String, enum: ['psychologist', 'user'] },
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist' },
	message: { type: String },
	read: { type: Boolean, default: false },
	socketId: { type: String },
	deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
export default ChatMessage;