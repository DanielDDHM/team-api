import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const BusinessSchema = new Schema({
	isActive: { type: Boolean, default: true },
	image: { type: String },
	logo: { type: String },
	name: { type: String },
	address: { type: String },
	address2: { type: String },
	postalCode: { type: String },
	city: { type: String },
	country: { type: Schema.Types.ObjectId, ref: 'Country' },
	state: { type: Schema.Types.ObjectId },
	email: { type: String },
	phone: { type: String },
	consultationsPerUser: { type: Number },
	users: [{
		isActive: { type: Boolean, default: true },
		role: {type: String, enum: ['hr', 'user'] },
		user: { type: Schema.Types.ObjectId, ref: 'User' },
		userNumber: { type: String },
	}],
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Business = mongoose.model('Business', BusinessSchema);
export default Business;