import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const ScheduleSchema = new Schema({
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist', required: true },
	date: { type: Date, required: true },
	slots: [{
		recurring: { type: Boolean },
		recurringEnd: { type: Date },
		recurringOriginSlot: { type: Schema.Types.ObjectId },
		start: { type: Number }, 
		end: { type: Number },
	}],
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

ScheduleSchema.index({ psychologist: 1, date: 1 }, { unique: true });
const Schedule = mongoose.model('Schedule', ScheduleSchema);
export default Schedule;
