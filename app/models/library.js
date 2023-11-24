import { mongoose } from '../utils/database';
import LanguageSchema from './schemas/language';
const { Schema } = mongoose;

const LibrarySchema = new Schema({
	category: { type: Schema.Types.ObjectId, ref: 'LibraryCategory' },
	type: { type: String, enum: { values: ['article', 'video', 'audio', 'survey'] } },
	image: { type: String },
	video: { type: String },
	audio: { type: String },
	name: LanguageSchema,
	description: LanguageSchema,
	published: { type: Boolean, deafult: false },
	publishSchedule: { type: Boolean, default: false },
	publishScheduleDate: { type: Date },
	notifyUsers: { type: Boolean, default: false },
	notificationTitle: LanguageSchema,
	notificationDescription: LanguageSchema,
	sendEmail: { type: Boolean, default: false },
	emailContent: LanguageSchema,
	businesses: [{ type: Schema.Types.ObjectId, ref: 'Business' }],
	notificationSent: { type: Boolean, default: false },
	surveyQuestions: [{
		question: LanguageSchema,
		answers: [{
			answer: LanguageSchema,
			value: { type: Number },
		}],
	}],
	surveyResults: [{
		minValue: { type: Number },
		maxValue: { type: Number },
		result: LanguageSchema,
		description: LanguageSchema,
	}],
	surveyAnswers: [{
		user: { type: Schema.Types.ObjectId, ref: 'User' },
		score: { type: Number },
		result: LanguageSchema,
		description: LanguageSchema,
		date: { type: Date },
	}],
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Library = mongoose.model('Library', LibrarySchema);
export default Library;