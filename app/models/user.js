import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const Schema = mongoose.Schema;
const UserSchema = new Schema({
	isConfirmed: { type: Boolean, default: false },
	confirmationDate: { type: Date },
	isDelete: { type: Boolean, default: false },
	isBanned: { type: Boolean, default: false },
	name: { type: String },
	birthdate: { type: Date },
	externalName: { type: String },
	email: {
		type: String,
		lowercase: true,
		trim: true,
		unique: true,
		match: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
	},
	newEmail: {
		type: String,
		lowercase: true,
		trim: true,
		match: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
	},
	phone: { type: String },
	photo: { type: String },
	password: { type: String },
	confirmationCode: { type: String, default: null },
	changeEmailCode: { type: String, default: null },
	resetCode: { type: String, default: null },
	marketingNotification: { type: Boolean, default: true },
	marketingEmail: { type: Boolean, default: true },
	psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist' },
	lastUsage: [{
		type: { type: String, enum: ['web','app']},
		os: { type: String },
		date: { type: Date },
	}],
}, { timestamps: { createdAt: '_created', updatedAt: '_modified' } });

UserSchema.methods.comparePassword = function (candidatePassword) {
	try {
		if (this.password) {
			return bcrypt.compareSync(candidatePassword, this.password);
		}
		return false;
	} catch (error) {
		return false;
	}
};

UserSchema.methods.displayInfo = function () {
	return {
		_id: this._id,
		email: this.email,
		newEmail: this.newEmail,
		phone: this.phone,
		name: this.name,
		externalName: this.externalName,
		birthdate: this.birthdate,
		photo: this.photo,
		isConfirmed: this.isConfirmed,
		psychologist: this.psychologist,
		marketingNotification: this.marketingNotification,
		marketingEmail: this.marketingEmail,
		lastUsage: this.lastUsage,
	};
};

const User = mongoose.model('User', UserSchema);
export default User;