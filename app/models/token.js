import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const TokenSchema = new Schema({
	user: {	type: Schema.Types.ObjectId, ref: 'User' },
	staff: { type: Schema.Types.ObjectId, ref: 'Staff' },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist' },
	authToken: { type: String, required: true },
	dateExpired: { type: Date, required: true },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Token = mongoose.model('Token', TokenSchema);
export default Token;