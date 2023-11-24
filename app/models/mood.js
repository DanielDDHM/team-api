import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const MoodSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	date: { type: Date },
	mood: {	type: String, enum: { values: ['very-happy', 'happy', 'normal', 'sad', 'very-sad', 'angry', 'bored', 'mad'] },	default: 'normal' },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Mood = mongoose.model('Mood', MoodSchema);
export default Mood;