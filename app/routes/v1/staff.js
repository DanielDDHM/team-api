// Packages
import express from 'express';
import bcrypt from 'bcrypt';
import _ from 'lodash';
import generator from 'generate-password';
import { DateTime } from 'luxon';

// Utils
import { checkToken, checkRole, formDataParser } from './index';
import { response } from '../../utils/misc';
import { uploadImage, deleteImage } from '../../utils/upload';
import { sendEmail } from '../../utils/email';
import errors from '../../utils/errors';
import config from '../../utils/config';

// Models
import Staff from '../../models/staff';
import Token from '../../models/token';
import Invite from '../../models/invite';

const postStaff = async (req, res, next) => {
	const { body, user } = req;
	console.log('BODY', body);
	console.log('user', user);

	if (user.role != 'owner' && user.role != 'sysadmin') throw errors.no_permission;

	let staff = await Staff.findOne({ email: body.email });
	console.log('STAFF', staff);

	const code = Math.floor(Math.random() * 9000) + 1000;
	let newStaff;
	if(!staff) {
		newStaff = new Staff({
			email: body.email,
			name: body.name,
			role: body.role,
			photo: null,
		});
		console.log('NEW STAFF', newStaff);
		newStaff = await newStaff.save();
	} else newStaff = await Staff.findOneAndUpdate({ _id: staff._id }, { role: body.role }, { new: true });
		
	const invite = await Invite({ staff: newStaff._id, from: user._id, invitationCode: code }).save();
	await sendEmail(config.keyEmails.confirmStaffLink, null, { ...config.emailTags, staff_name: user.name, staff_email: user.email, link: `${process.env.BO_URL}/accept-invite/${invite._id}/${code}` }, newStaff.email );

	const allStaff = await Staff.find();

	return { code: 201, staff: allStaff };
};

const postRecoverPasswordStaff = async (req, res, next) => {
	const { body, params } = req;

	const codeParams = params.code;
	if (!codeParams) {
		const staff = await Staff.findOne({ email: body.email });
		console.log('STAFF', staff);
		if (!staff) return { code: 200 };

		const resetCode = Math.floor(Math.random() * 9000) + 1000;
		await Staff.updateOne({ _id: staff._id }, { $set: { resetCode: resetCode } });


		await sendEmail(config.keyEmails.recoverStaffLink, null, { ...config.emailTags, link: `${process.env.BO_URL}/recover-password/${staff._id}/${resetCode}` }, staff.email );
		
		return { code: 200 };
	} else {
		const staff = await Staff.findOneAndUpdate({ resetCode: codeParams, _id: body._id }, { confirmed: true, password: bcrypt.hashSync(body.password, 10), resetCode: null }, { new: true });

		if (!staff) throw errors.invalid_credentials;

		return { code: 200 };
	}
};

const putStaff = async (req, res, next) => {
	const { body, params, user } = req;

	const staff = await Staff.findOne({ _id: params.id });
	if (!staff) throw errors.not_found;
	if ((params.id != user._id) && (user.role != 'owner' && user.role != 'sysadmin')) throw errors.no_permission;

	if (body.filesToDelete && body.filesToDelete.length) {
		await deleteImage(body.filesToDelete[0], 'staff');
		body.photo = null;
	}

	if (body.files && body.files.length) {
		if (!!body.files) {
			body.photo = await uploadImage(body.files[0], 'staff');
		}
	}

	console.log('body', body);
	const updatedStaff = await Staff.findOneAndUpdate({ _id: params.id }, body, { fields: '-password', new: true });

	return { code: 200, staff: updatedStaff };
};

const putStaffPassword = async function (req, res, next) {
	const { body, user } = req;

	const staff = await Staff.findOne({ _id: user._id });
	if (!staff || !staff.comparePassword(body.password)) throw errors.invalid_credentials;

	const newPassword = bcrypt.hashSync(body.newPassword, 10);
	await Staff.updateOne({ _id: staff._id },{ password: newPassword },{ fields: '-password', new: true });

	return { code: 200 };
};

const getStaff = async (req, res, next) => {
	const { params: { id }, user } = req;

	let staff;
	if (id) {
		const userId = id === 'me' ? user._id : id;
		staff = await Staff.findOne({ _id: userId }, '-password').lean();
	} else staff = await Staff.find().select({ _id: 1, name: 1, email: 1, photo: 1, confirmed: 1, role: 1, isActive: 1, isConfirmed: 1 });
	
	return { code: 200, staff };
};

const getInvites = async req => {
	const { id, invitationCode } = req.params;

	if(id === 'undefined' || id == null) throw errors.bad_request;
    
	const invite = await Invite.findOne({ _id: id, invitationCode: invitationCode }).populate('staff from');
    
	return { code: 200, invite };
};

const patchResendInvite = async (req, res, next) => {
	const { params: { id }, user } = req;

	const invite = await Invite.findOne({ staff: id }).populate('staff from');

	if (invite)	{
		await sendEmail(config.keyEmails.confirmStaffLink, null, { ...config.emailTags, staff_name: invite.from.name, staff_email: invite.from.email, link: `${process.env.BO_URL}/accept-invite/${invite._id}/${invite.invitationCode}` }, invite.staff.email );
	} else {
		const code = Math.floor(Math.random() * 9000) + 1000;
		
		const invite = await Invite({ staff: id, from: user._id, invitationCode: code }).save();

		await sendEmail(config.keyEmails.confirmStaffLink, null, { ...config.emailTags, staff_name: user.name, staff_email: user.email, link: `${process.env.BO_URL}/accept-invite/${invite._id}/${invite.invitationCode}` }, invite.staff.email );
	}

	const staff = await Staff.find({},'-password');

	return { code: 200, staff };
};

const patchActiveStaff = async (req, res, next) => {
	const { id } = req.params;
	const { body } = req;

	if ('isActive' in body) {
		await Staff.updateOne({ _id: id },{ isActive: body.isActive });
	} else throw errors.required_fields_empty;

	const staff = await Staff.find({},'-password');

	return { code: 200, staff };
};

const deleteStaff = async (req, res, next) => {
	const { params: { id } } = req;
	
	await Staff.deleteOne({ _id: id });

	const allStaff = await Staff.find({}, '-password');

	return { code: 200, staff: allStaff };
};

const postConfirmStaff = async function (req, res, next) {
	const { body } = req;

	if (!body.invite) throw errors.invalid_parameter;

	const invite = await Invite.findOne({ _id: body.invite, invitationCode: body.invitationCode });

	if (!invite || !invite.staff._id || !invite.from._id) throw errors.invalid_parameter;

	let staff = await Staff.findOne({ _id: invite.staff._id });

	if (body.password) {
		const password = bcrypt.hashSync(body.password, 10);
		await Staff.updateOne({ _id: invite.staff._id },{ password, isConfirmed: true });
	}
	await Invite.findOneAndDelete({ _id: invite._id });

	const token = generator.generateMultiple(2, { length: 30, numbers: true }).toString().replace(',', '.');
	const newToken = new Token({
		staff: staff._id,
		authToken: token,
		dateExpired: DateTime.utc().plus({ days: config.tokenDuration }).toISO(),
	});
	await newToken.save();

	return { code: 200, staff, token };
};

//Router
const staffRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, staff } = await getStaff(req, res, next);
			response(req, res, code, 'STAFF_FOUND', 'Staff found', { staff });
		}))
		.get('/invite/:id/code/:invitationCode', errorHandler(async (req,res, next) => {
			const { code, invite } = await getInvites(req);
			response(req,res, code, 'INVITE_FOUND', 'Invite Found', { invite });
		}))

		.post('/', checkToken(), checkRole('sysadmin', 'owner'), errorHandler(async (req, res, next) => {
			const { code, staff } = await postStaff(req, res, next);
			response(req, res, code, 'STAFF_CREATED', 'Staff has been created', { staff });
		}))
		.post('/recover-password/:code?', errorHandler(async (req, res, next) => {
			const { code } = await postRecoverPasswordStaff(req, res, next);
			response(req, res, code, 'PASSWORD_RESET', 'Staff password reset', {});
		}))
		.post('/confirm/', errorHandler(async (req, res, next) => {
			const { code, staff, token } = await postConfirmStaff(req, res, next);
			response(req, res, code, 'STAFF_CONFIRMED', 'Staff has been confirmed', { staff, token });
		}))

		.put('/password/', checkToken(), errorHandler(async (req, res, next) => {
			const { code } = await putStaffPassword(req, res, next);
			response(req, res, code, 'STAFF_UPDATED', 'Staff has been updated' );
		}))
		.put('/:id', checkToken(), formDataParser(), errorHandler(async (req, res, next) => {
			const { code, staff } = await putStaff(req, res, next);
			response(req, res, code, 'STAFF_UPDATED', 'Staff has been updated', { staff });
		}))

		.patch('/resend-invite/:id', checkToken(), checkRole('sysadmin', 'owner'), errorHandler(async (req, res, next) => {
			const { code, staff } = await patchResendInvite(req, res, next);
			response(req, res, code, 'INVITE_RESENTED', 'Staff Invite has been resented', { staff });
		}))
		.patch('/:id', checkToken(), checkRole('sysadmin', 'owner'), errorHandler(async (req, res, next) => {
			const { code, staff } = await patchActiveStaff(req, res, next);
			response(req, res, code, 'STAFF_UPDATED', 'Staff has been updated.', { staff });
		}))
		
		.delete('/:id', checkToken(), checkRole('sysadmin', 'owner'), errorHandler(async (req, res, next) => {
			const { code, staff } = await deleteStaff(req, res, next);
			response(req, res, code, 'STAFF_DELETED', 'Staff has been deleted', { staff });
		}));
	return router;
};

export const router = staffRouter;