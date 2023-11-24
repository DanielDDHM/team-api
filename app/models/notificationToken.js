import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const NotificationTokenSchema = new Schema({
	user: {	type: Schema.Types.ObjectId, ref: 'User', default: null },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist',	default: null },
	token: { type: String, unique: true, required: true	},
	device: { type: String,	enum: {	values: ['ios', 'android', 'web'] }, required: true	},
	language: {	type: String, default: 'en'	},
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const NotificationToken = mongoose.model('NotificationToken', NotificationTokenSchema);
export default NotificationToken;