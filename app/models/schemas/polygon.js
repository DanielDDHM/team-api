import { mongoose } from '../../utils/database';

const Schema = mongoose.Schema;
const PolygonSchema = new Schema({
	type: { type: String, enum: ['Polygon'], required: true, default: 'Polygon' },
	coordinates: { type: [[[Number]]], required: true, default: [[[0,0], [0,0]]] },
});

export default PolygonSchema;