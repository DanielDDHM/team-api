import { mongoose } from '../utils/database';
import LanguageSchema from './schemas/language';

const Schema = mongoose.Schema;
const ScheduleNotificationSchema = new Schema({
	sent: { type: Boolean, default: false },
	scheduleDate: { type: Date },
	title: LanguageSchema,
	description: LanguageSchema,
	sendEmail: { type: Boolean, default: false },
	emailContent: LanguageSchema,
	businesses: [{ type: Schema.Types.ObjectId, ref: 'Business' }],
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const ScheduleNotification = mongoose.model('ScheduleNotification', ScheduleNotificationSchema);
export default ScheduleNotification;