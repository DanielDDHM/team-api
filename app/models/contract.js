import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const ContractSchema = new Schema({
	business: { type: Schema.Types.ObjectId, ref: 'Business' },
	startDate: { type: Date },
	endDate: { type: Date },
	description: { type: String },
	value: { type: Number },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Contract = mongoose.model('Contract', ContractSchema);
export default Contract;