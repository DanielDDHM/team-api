import { mongoose } from '../utils/database';
import bcrypt from 'bcrypt';

const Schema = mongoose.Schema;
const PsychologistSchema = new Schema({
	isActive: {	type: Boolean,	default: true },
	isConfirmed: { type: Boolean,	default: false },
	connectedSocket: { type: Boolean,	default: false },
	name: {	type: String, required: true },
	externalName: {	type: String, required: true },
	email: {
		type: String,
		required: true,
		trim: true,
		unique: true,
		lowercase: true,
		match: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
	},
	password: {	type: String },
	language: {	type: String, default: 'pt'	},
	phone: { type: String },
	photo: { type: String },
	confirmationCode: { type: String	},
	resetCode: { type: String },
	about: { type: String },
	skills: [{ type: Schema.Types.ObjectId, ref: 'Diagnosis' }],
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

PsychologistSchema.methods.comparePassword = function (candidatePassword) {
	if (this.password) {
		return bcrypt.compareSync(candidatePassword, this.password);
	}
	return false;
};

PsychologistSchema.methods.displayInfo = function () {
	return {
		_id: this._id,
		name: this.name,
		externalName: this.externalName,
		email: this.email,
		phone: this.phone,
		photo: this.photo,
		isActive: this.isActive,
		isConfirmed: this.isConfirmed,
		about: this.about,
		skills: this.skills,
	};
};

PsychologistSchema.plugin(require('mongoose-autopopulate'));
const Psychologist = mongoose.model('Psychologist', PsychologistSchema);
export default Psychologist;