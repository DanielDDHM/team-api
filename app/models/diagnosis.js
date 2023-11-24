import { mongoose } from '../utils/database';
import LanguageSchema from '../models/schemas/language';
const { Schema } = mongoose;

const DiagnosisSchema = new Schema({
	isActive: { type: Boolean, default: false },
	name: LanguageSchema,
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Diagnosis = mongoose.model('Diagnosis', DiagnosisSchema);
export default Diagnosis;