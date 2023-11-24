import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const CallSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist' },
	startDate: { type: Date, required: true	},
	endDate: { type: Date },
	twilioRoom: { type: Object },
	twilioPsychologistEntered: { type: Boolean, default: false },
	twilioPsychologistEnteredDate: { type: Date },
	twilioStatus: [{ type: Object }],
	rating: { type: Number },
	finished: { type: Boolean, default: false },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

CallSchema.plugin(require('mongoose-autopopulate'));
const Call = mongoose.model('Call', CallSchema);
export default Call;
