import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const ConsultationSchema = new Schema({
	consultationNumber: { type: String, unique: true, index: true },
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist', required: true },
	treatment: { type: Schema.Types.ObjectId, ref: 'Treatment' },
	business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
	// contract: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
	startDate: { type: Date, required: true	},
	endDate: { type: Date, required: true },
	duration: {	type: Number, required: true },
	cancelled: { type: Boolean,	default: false },
	cancelledBy: { type: String, enum: { values: [ 'user', 'psychologist', 'team' ]} },
	cancelledDate: { type: Date },
	cancelledPaid: { type: Boolean,	default: false },
	diagnostics: [{ type: Schema.Types.ObjectId, ref: 'Diagnosis' }],
	clinicalIntervention: { type: String },
	clinicalRecord: { type: String },
	goalsNextConsultation: { type: String },
	twilioRoom: { type: Object },
	twilioUserEntered: { type: Boolean, default: false },
	twilioUserEnteredDate: { type: Date },
	twilioPsychologistEntered: { type: Boolean, default: false },
	twilioPsychologistEnteredDate: { type: Date },
	twilioStatus: [{ type: Object }],
	nextConsultation: { type: Schema.Types.ObjectId, ref: 'Consultation' },
	rating: { type: Number },
	finished: { type: Boolean, default: false },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

ConsultationSchema.plugin(require('mongoose-autopopulate'));
const Consultation = mongoose.model('Consultation', ConsultationSchema);
export default Consultation;
