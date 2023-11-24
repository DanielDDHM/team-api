import { mongoose } from '../../utils/database';

const Schema = mongoose.Schema;
const LanguageSchema = new Schema({
	pt: { type: String, default: '' },
	en: { type: String, default: '' },
	es: { type: String, default: '' },
}, { _id: false });

export default LanguageSchema;