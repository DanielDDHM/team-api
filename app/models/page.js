import { mongoose } from '../utils/database';
import LanguageSchema from './schemas/language';

const Schema = mongoose.Schema;
const PageSchema = new Schema({
	title: LanguageSchema,
	content: LanguageSchema,
	type: { type: String, enum: ['terms','privacy']},
	isActive: { type: Boolean, default: false },
});

const Page = mongoose.model('Page', PageSchema);
export default Page;