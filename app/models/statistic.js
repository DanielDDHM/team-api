import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const StatisticSchema = new Schema({
	date: { type: Date },
	user: {	type: Schema.Types.ObjectId, ref: 'User' },
	business: {	type: Schema.Types.ObjectId, ref: 'Business' },
	screen: { type: String },
	type: { type: String, enum: ['web','app']},
	deviceId: {	type: String },
	platform: {	type: String },
	os: { type: String },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Statistic = mongoose.model('Statistic', StatisticSchema);
export default Statistic;