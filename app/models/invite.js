import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const InviteSchema = new Schema({
	staff: { type: Schema.Types.ObjectId, ref: 'Staff' },
	from: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
	invitationCode: { type: String },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

const Invite = mongoose.model('Invite', InviteSchema);
export default Invite;