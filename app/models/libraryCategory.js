import { mongoose } from '../utils/database';
import LanguageSchema from './schemas/language';
const { Schema } = mongoose;

const LibraryCategorySchema = new Schema({
	name: LanguageSchema,
	type: { type: String, enum: ['meditation', 'exercises', 'survey', 'courses'] },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const LibraryCategory = mongoose.model('LibraryCategory', LibraryCategorySchema);
export default LibraryCategory;