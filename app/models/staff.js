import { mongoose } from '../utils/database';
import bcrypt from 'bcrypt';

const Schema = mongoose.Schema;
const StaffSchema = new Schema({
	isActive: {	type: Boolean,	default: true },
	isConfirmed: { type: Boolean,	default: false },
	name: {	type: String, required: true },
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
	photo: { type: String },
	confirmCode: { type: String	},
	resetCode: { type: String },
	role: {	type: String, enum: { values: ['sysadmin', 'owner', 'admin'] },	default: 'admin' },
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

StaffSchema.methods.comparePassword = function (candidatePassword) {
	try {
		if (this.password) {
			return bcrypt.compareSync(candidatePassword, this.password);
		}
		return false;
	} catch (error) {
		return false;
	}	
};

StaffSchema.methods.displayInfo = function () {
	return {
		_id: this._id,
		name: this.name,
		email: this.email,
		phone: this.phone,
		photo: this.photo,
		role: this.role,
		isActive: this.isActive,
		isConfirmed: this.isConfirmed,
	};
};

StaffSchema.plugin(require('mongoose-autopopulate'));
const Staff = mongoose.model('Staff', StaffSchema);
export default Staff;