import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const LogSchema = new Schema({
	level: { type: String },
	message: { type: String },
	response: { type: String },
	description: { type: String },
	date: { type: Date },
	token: { type: String },
	method: { type: String },
	userId: { type: String },
	code: { type: Number },
	source: { type: String },
	meta: { type: Schema.Types.ObjectId, ref: 'Meta' },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Log = mongoose.model('Log', LogSchema);
export default Log;