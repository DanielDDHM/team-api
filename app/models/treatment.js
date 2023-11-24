import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const TreatmentSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	diagnostics: [{ type: Schema.Types.ObjectId, ref: 'Diagnosis' }],
	startDate: { type: Date },
	medication: { type: Boolean },
	medicationDescription: { type: String },
	goals: { type: String },
	anamnesis: { type: String },
	clinicalDischarge: { type: Date },
	reviewed: { type: Boolean, default: false },
	review: {
		general: { type: Number },
		psychologist: { type: Number },
		pontuality: { type: Number },
		consultationNumbers: { type: Number },
		willBack: { type: Number },
		recomendation: { type: Number },
		motivation: { type: Number },
		balance: { type: Number },
		keepService: { type: Number },
		notes: { type: String },
	},
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Treatment = mongoose.model('Treatment', TreatmentSchema);
export default Treatment;