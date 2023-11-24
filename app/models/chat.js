import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const ChatSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist' },
	startDate: { type: Date, required: true	},
	endDate: { type: Date },
	psychologistAccepted: { type: Boolean, default: false },
	psychologistAcceptedDate: { type: Date },
	socketId: { type: String },
	rating: { type: Number },
	finished: { type: Boolean, default: false },
	deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Chat = mongoose.model('Chat', ChatSchema);
export default Chat;