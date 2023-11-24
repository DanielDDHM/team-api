import { mongoose } from '../utils/database';
import LanguageSchema from '../models/schemas/language';

const Schema = mongoose.Schema;
const NotificationSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist', default: null },
	title: { type: LanguageSchema },
	message: { type: LanguageSchema },
	read: {	type: Boolean, default: false },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;