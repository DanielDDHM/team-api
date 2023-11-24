import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const MetaSchema = new Schema({
	response: { type: String },
	date: { type: Date },
	res: {
		results: { type: Object },
		statusCode: { type: Number, index: true },
	},
	req: {
		url: { type: String },
		headers: { type: Object },
		method: { type: String, index: true },
		httpVersion: { type: String },
		originalUrl: { type: String },
		query: { type: Object },
		body: { type: Object },
	},
	responseTime: { type: Number },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Meta = mongoose.model('Meta', MetaSchema);
export default Meta;