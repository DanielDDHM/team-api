import { mongoose } from '../../utils/database';

const Schema = mongoose.Schema;
const PointSchema = new Schema({
	type: { $type: String, enum: ['Point'], required: true, default: 'Point' },
	coordinates: { $type: [Number], required: true, default: [0,0] },
}, { _id: false, typeKey: '$type' });

export default PointSchema;