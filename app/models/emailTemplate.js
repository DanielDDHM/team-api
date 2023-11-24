import { mongoose } from '../utils/database';
import LanguageSchema from './schemas/language';

const Schema = mongoose.Schema;
const EmailSchema = new Schema({
	key: { type: String },
	to: { type: String },
	subject: LanguageSchema,
	values: LanguageSchema,
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const EmailModel = mongoose.model('Email', EmailSchema);
export default EmailModel;
