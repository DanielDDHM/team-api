// Packages
import express from 'express';
import _, { isError } from 'lodash';

// Utils
import { checkToken, checkRole, checkUserHR, formDataParser } from './index';
import { response } from '../../utils/misc';
import { uploadImage, deleteImage } from '../../utils/upload';
import { sendEmail } from '../../utils/email';
import errors from '../../utils/errors';
import config from '../../utils/config';
import xlsx from 'xlsx';

// Models
import Business from '../../models/business';
import User from '../../models/user';
import Consultation from '../../models/consultation';
import Contract from '../../models/contract';

const getBusiness = async (req) => {
	const { params: { id } } = req;
	let business;
	let contracts;
    
	if (id) {
		[business, contracts] = await Promise.all([
			Business.findOne({ _id: id }).populate({ path: 'users.user', select: 'photo name email isConfirmed phone' }).lean(),
			Contract.find({ business: id }).lean(),
		]);
		if (!business) throw errors.not_found;
		business.contracts = contracts;
	} else {business = await Business.aggregate([
		{ $project: { logo: 1, name: 1 } },
		{ $lookup: {
			from: 'contracts',
			let: { businessId: '$_id' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$business', '$$businessId'] } } },
				{ $group: { _id: null, count: { $sum: '$value' } } },
			],
			as: 'contracts',
		} },
		{ $lookup: {
			from: 'consultations',
			let: { businessId: '$_id' },
			pipeline: [
				{ $match: { $expr: { $and: [
					{ $eq: ['$business', '$$businessId'] },
					{ $eq: ['$cancelled', false ] },
				] } } },
				{ $group: { _id: null, count: { $sum: 1 } } },
			],
			as: 'consultations',
		} },
		{ $addFields: { 
			contracts: { $arrayElemAt: ['$contracts', 0] },
			consultations: { $arrayElemAt: ['$consultations', 0] },
		} },
		{ $project: {
			logo: 1, 
			name: 1,
			consultationsBought: { $cond: [ { $eq: ['$contracts', null] }, 0, '$contracts.count' ] },
			consultationsUsed: { $cond: [ { $eq: ['$consultations', null] }, 0, '$consultations.count' ] },
		} },
	]);}

	return { code: 200, business };
};

const getBusinessUsers = async (req) => {
	const { user } = req;  

	const business = await Business.findOne({ _id: user.businessId, users: { $elemMatch: { user: user._id, isActive: true } } }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const postBusiness = async (req) => {
	const { body, user } = req;

	if (!body.name || !body.country || !body.hrName || !body.hrEmail) throw errors.required_fields_empty;

	let newUser = await User.findOne({ email: body.hrEmail });
	if (newUser) {
		const existBusinessUser = await Business.findOne({ users: { $elemMatch: { user: newUser._id, isActive: true } } });
		if (existBusinessUser) throw errors.record_in_use;
	}

	for (const img of body.files) {
		console.log('IMAGE', img);
		if (img.fieldName === 'image') body.image = await uploadImage(img, 'business');
		if (img.fieldName === 'logo') body.logo = await uploadImage(img, 'business');
	}

	let business = await Business(body).save();

	const code = Math.floor(Math.random() * 9000) + 1000;
	if(!newUser) {
		newUser = new User({
			email: body.hrEmail,
			name: body.hrName,
			phone: body.hrPhone,
			confirmationCode: code,
			photo: null,
		});
		await newUser.save();
	};

	if (!newUser.isConfirmed) {
		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/confirm-account/${newUser.email}/${code}` }, newUser.email );
	}   

	business = await Business.findOneAndUpdate({ _id: business._id }, { $push: { users: { role: 'hr', user: newUser._id } } }, { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, business };
};

const postBusinessHRUser = async (req) => {
	const { params: { id }, body } = req;
	console.log('ENTRE 0', body);

	if (!body.name || !body.email) throw errors.required_fields_empty;

	let [ business, newUser ] = await Promise.all([
		Business.findOne({ _id: id }),
		User.findOne({ email: body.email }),
	]);

	if (!business) throw errors.invalid_parameter;
	if (newUser && (business.users.find(user => String(user.user) == String(newUser._id)))) throw errors.duplicate_email;

	const code = Math.floor(Math.random() * 9000) + 1000;
	if(!newUser) {
		newUser = new User({
			email: body.email,
			name: body.name,
			phone: body.phone,
			confirmationCode: code,
			photo: null,
		});
		await newUser.save();
	};

	if (!newUser.isConfirmed) {
		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/confirm-account/${newUser.email}/${code}` }, newUser.email );
	}   

	business = await Business.findOneAndUpdate({ _id: id }, { $push: { users: { role: body.role, user: newUser._id, userNumber: body.userNumber ? body.userNumber : null } } }, { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const postBusinessUser = async (req) => {
	const { user, body } = req;
	console.log('ENTRE 0', body);

	if (!body.name || !body.email) throw errors.required_fields_empty;

	let [ business, newUser ] = await Promise.all([
		Business.findOne({ _id: user.businessId, users: { $elemMatch: { user: user._id, isActive: true } } }),
		User.findOne({ email: body.email }),
	]);

	if (!business) throw errors.invalid_parameter;
	if (newUser && (business.users.find(user => String(user.user) == String(newUser._id)))) throw errors.duplicate_email;

	const code = Math.floor(Math.random() * 9000) + 1000;
	if(!newUser) {
		newUser = new User({
			email: body.email,
			name: body.name,
			phone: body.phone,
			confirmationCode: code,
			photo: null,
		});
		await newUser.save();
	} else {
		const existUserBusiness = await Business.findOne({ users: { $elemMatch: { user: newUser._id, isActive: true } } });
		if (existUserBusiness) throw errors.record_in_use;
	}

	if (!newUser.isConfirmed) {
		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/confirm-account/${newUser.email}/${code}` }, newUser.email );
	}   

	business = await Business.findOneAndUpdate({ _id: business._id }, { $push: { users: { role: body.role, user: newUser._id, userNumber: body.userNumber ? body.userNumber : null } } }, { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const postImportBusinessUsers = async (req) => {
	const { user, body: { files } } = req;
    
	if (!files || !files.length) throw errors.required_fields_empty;
	const workbook = xlsx.read(files[0].file);
	const sheet = workbook.SheetNames[0];
	if(!sheet) throw errors.required_fields_empty;

	let business = await Business.findOne({ _id: user.businessId, users: { $elemMatch: { user: user._id, isActive: true } } });
	if (!business) throw errors.invalid_parameter;

	let businessUsers = business.users.length ? business.users : [];

	const invalidUsers = [];

	const users = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

	for (let newImportUser of users) {
		console.log('IMPORT USER', newImportUser);
		if (!newImportUser.Email || !newImportUser.Name) {
			newImportUser.error = 'Nome ou Email em falta';
			invalidUsers.push(newImportUser);
			continue;
		}

		let newUser = await User.findOne({ email: newImportUser.Email });
		if (newUser && (businessUsers.find(user => String(user.user) == String(newUser._id)))) {
			newImportUser.error = 'Utilizador já importado';
			invalidUsers.push(newImportUser);
			continue;
		}

		if (newUser) {
			const userOtherBusiness = Business.findOne({ users: { $elemMatch: { user: newUser._id, isActive: true } } }).select('name').lean();
			if (userOtherBusiness) {
				newImportUser.error = 'Utilizador ativo em outra entidade';
				invalidUsers.push(newImportUser);
				continue;
			}
		}
    
		const code = Math.floor(Math.random() * 9000) + 1000;
		if(!newUser) {
			newUser = new User({
				email: newImportUser.Email,
				name: newImportUser.Name,
				phone: newImportUser.Phone,
				confirmationCode: code,
				photo: null,
			});
			await newUser.save();
		};
    
		if (!newUser.isConfirmed) {
			await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/confirm-account/${newUser.email}/${code}` }, newUser.email );
		}
        
		await Business.updateOne({ _id: business._id }, { $push: { users: { role: 'user', user: newUser._id, userNumber: newImportUser.UserNumber ? newImportUser.UserNumber : null } } });
		businessUsers.push({ role: 'user', user: newUser._id, userNumber: newImportUser.UserNumber ? newImportUser.UserNumber : null });
	}

	business = await Business.findOne({ _id: business._id }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users, invalidUsers };
};

const postBusinessContract = async (req) => {
	const { params: { id }, body } = req;
    
	if (!body.startDate || !body.endDate || !body.value) throw errors.required_fields_empty;
	if (!body.business) body.business = id;
    
	console.log('ENTRE 0', body);

	await new Contract(body).save();
	const contracts = await Contract.find({ business: id }).sort({ startDate: -1 });

	return { code: 200, contracts };
};

const patchResendInvite = async (req, res, next) => {
	const { params: { id, idUser } } = req;
    
	const [ business, user ] = await Promise.all([
		Business.findOne({ _id: id, 'users.user': idUser }).lean(),
		User.findOne({ _id: idUser }).lean(),
	]);
	if (!business || !user) throw errors.invalid_parameter;

	if (!user.isConfirmed) {
		let code = user.confirmationCode;
		if (!user.confirmationCode) {
			const newCode = Math.floor(Math.random() * 9000) + 1000;
			await User.updateOne({ _id: user._id }, { confirmationCode: newCode });
			code = newCode;
		}
		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/confirm-account/${user.email}/${code}` }, user.email );
	}

	return { code: 200 };
};


const putBusiness = async (req) => {
	const { params: { id }, body } = req;
    
	if (!body.name) throw errors.required_fields_empty;
	const existingBusiness = await Business.findOne({ _id: id });
    
	if (!body.logo && existingBusiness.logo) {
		console.log('DELETE LOGO', existingBusiness.logo);
		deleteImage(existingBusiness.logo, 'business');
		body.logo = null;
	}
	if (!body.image && existingBusiness.image) {
		console.log('DELETE IMAGE', existingBusiness.image);
		deleteImage(existingBusiness.image, 'business');
		body.image = null;
	}
    
	for (const img of body.files) {
		console.log('IMAGE', img);
		if (img.fieldName === 'image') body.image = await uploadImage(img, 'business');
		if (img.fieldName === 'logo') body.logo = await uploadImage(img, 'business');
	}
    
	const business  = await Business.findOneAndUpdate({ _id: id }, body, { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'}).lean();
    
	return { code: 200, business };
};

const putBusinessHRUser = async (req, res, next) => {
	const { params: { id, idUser }, body } = req;

	let business = await Business.findOne({ _id: id, 'users._id': idUser });
	if (!business) throw errors.invalid_parameter;

	business  = await Business.findOneAndUpdate({ _id: id, 'users._id': idUser }, { $set: { 'users.$.role': body.role }} , { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const putBusinessUser = async (req, res, next) => {
	const { params: { id }, body, user } = req;

	if (!body.role) throw errors.required_fields_empty;

	let [ business, existUser ] = await Promise.all([
		Business.findOne({ _id: user.businessId, users: { $elemMatch: { user: user._id, isActive: true } } }),
		User.findOne({ _id: id }),
	]);
	if (!business || !existUser) throw errors.invalid_parameter;

	existUser = business.users.find(user => String(user.user) == String(existUser._id));
	if (!existUser) throw errors.invalid_parameter;
	console.log('EXIST USER', existUser);

	business  = await Business.findOneAndUpdate({ _id: business._id, 'users._id': existUser._id }, { $set: { 'users.$.role': body.role, 'users.$.userNumber': body.userNumber }} , { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const putBusinessContract = async (req) => {
	const { params: { id, idContract }, body } = req;
	console.log('ENTRE 0', body);

	if (!body.startDate || !body.endDate || !body.value) throw errors.required_fields_empty;
	if (!body.business) body.business = id;

	await Contract.updateOne({ _id: idContract, business: id }, body);
	const contracts = await Contract.find({ business: id }).sort({ startDate: -1 });

	return { code: 200, contracts };
};

const patchBusiness = async (req) => {
	const { params: { id }, body } = req;

	if (body.isActive == null) throw errors.required_fields_empty;
    
	await Business.findOneAndUpdate({ _id: id }, { isActive: body.isActive });
    
	const business = await Business.find();

	return { code: 200, business };
};

const patchBusinessHRUser = async (req) => {
	const { params: { id, idUser }, body } = req;
    
	if (body.isActive == null) throw errors.required_fields_empty;
    
	let business = await Business.findOne({ _id: id, 'users._id': idUser });
	if (!business) throw errors.invalid_parameter;

	business  = await Business.findOneAndUpdate({ _id: id, 'users._id': idUser }, { $set: { 'users.$.isActive': body.isActive }} , { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const patchBusinessUser = async (req) => {
	const { params: { id }, body, user } = req;

	if (body.isActive == null) throw errors.required_fields_empty;

	let [ business, existUser ] = await Promise.all([
		Business.findOne({ _id: user.businessId, users: { $elemMatch: { user: user._id, isActive: true } } }),
		User.findOne({ _id: id }),
	]);
	if (!business || !existUser) throw errors.invalid_parameter;

	existUser = business.users.find(user => String(user.user) == String(existUser._id));
	if (!existUser) throw errors.invalid_parameter;
	console.log('EXIST USER', existUser);

	if (body.isActive === true) {
		const existUserBusiness = await Business.findOne({ users: { $elemMatch: { user: existUser._id, isActive: true } } });
		if (existUserBusiness) throw errors.record_in_use;
	}

	business  = await Business.findOneAndUpdate({ _id: business._id, 'users._id': existUser._id }, { $set: { 'users.$.isActive': body.isActive }} , { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const deleteBusiness = async (req) => {
	const { id } = req.params;

	await Business.deleteOne({ _id: id });

	const business = await Business.find();

	return { code: 200, business };
};

const deleteBusinessHRUser = async (req) => {
	const { id, idUser } = req.params;

	const [ existConsultations ] = await Promise.all([
		Consultation.findOne({ user: idUser, business: id }).lean(),
	]);
	if (existConsultations) throw errors.record_in_use;

	const business  = await Business.findOneAndUpdate({ _id: id, 'users._id': idUser }, { $pull: { users: { _id: idUser }}}, { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const deleteBusinessUser = async (req) => {
	const { params: { id }, body, user } = req;

	let [ business, existUser ] = await Promise.all([
		Business.findOne({ _id: user.businessId, users: { $elemMatch: { user: user._id, isActive: true } } }),
		User.findOne({ _id: id }),
	]);
	if (!business || !existUser) throw errors.invalid_parameter;

	existUser = business.users.find(user => String(user.user) == String(existUser._id));
	if (!existUser) throw errors.invalid_parameter;
	console.log('EXIST USER', existUser);

	const [ existConsultations ] = await Promise.all([
		Consultation.findOne({ user: id, business: business._id }).lean(),
	]);
	if (existConsultations) throw errors.record_in_use;

	business  = await Business.findOneAndUpdate({ _id: business._id, 'users._id': existUser._id }, { $pull: { users: { _id: existUser._id }}}, { new: true }).populate({ path: 'users.user', select: 'name email phone photo isConfirmed'});

	return { code: 200, users: business.users };
};

const deleteBusinessContract = async (req) => {
	const { params: { id, idContract }, body } = req;

	await Contract.deleteOne({ _id: idContract, business: id });
	const contracts = await Contract.find({ business: id }).sort({ startDate: -1 });

	return { code: 200, contracts };
};

//Router
const businessesRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/users', checkToken(), checkRole('user'), checkUserHR(), errorHandler(async (req, res, next) => {
			const { code, users } = await getBusinessUsers(req,res,next);
			response(req, res, code, 'BUSINESS_USERS_FOUND', 'Business Users found', { users });
		}))
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, business } = await getBusiness(req,res,next);
			response(req, res, code, 'BUSINESS_FOUND', 'Business found', { business });
		}))
        
		.post('/', checkToken(), formDataParser(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, business } = await postBusiness(req,res,next);
			response(req, res, code, 'BUSINESS_CREATED', 'Business has been created', { business });
		}))
		.post('/:id/hr/', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, users } = await postBusinessHRUser(req,res,next);
			response(req, res, code, 'BUSINESS_USER_CREATED', 'Business User has been created', { users });
		}))
		.post('/users/', checkToken(), checkRole('user'), checkUserHR(), errorHandler(async (req, res, next) => {
			const { code, users } = await postBusinessUser(req,res,next);
			response(req, res, code, 'BUSINESS_USER_CREATED', 'Business User has been created', { users });
		}))
		.post('/:id/contracts/', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, contracts } = await postBusinessContract(req,res,next);
			response(req, res, code, 'BUSINESS_CONTRACT_CREATED', 'Business Contract has been created', { contracts });
		}))
		.post('/import/', checkToken(), formDataParser(), checkRole('user'), checkUserHR(), errorHandler(async (req, res, next) => {
			const { code, users, invalidUsers } = await postImportBusinessUsers(req,res,next);
			response(req, res, code, 'BUSINESS_USERS_CREATED', 'Business Users has been imported', { users, invalidUsers });
		}))

		.put('/:id', checkToken(), formDataParser(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, business } = await putBusiness(req, res, next);
			response(req, res, code, 'BUSINESS_UPDATED', 'Business has been updated', { business });
		}))
		.put('/:id/hr/:idUser', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, users } = await putBusinessHRUser(req, res, next);
			response(req, res, code, 'BUSINESS_USER_UPDATED', 'Business User has been updated', { users });
		}))
		.put('/:id/contracts/:idContract', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, contracts } = await putBusinessContract(req,res,next);
			response(req, res, code, 'BUSINESS_CONTRACT_UPDATED', 'Business Contract has been updated', { contracts });
		}))
		.put('/users/:id', checkToken(), checkRole('user'), checkUserHR(), errorHandler(async (req, res, next) => {
			const { code, users } = await putBusinessUser(req, res, next);
			response(req, res, code, 'BUSINESS_USER_UPDATED', 'Business User has been updated', { users });
		}))

		.patch('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, business } = await patchBusiness(req, res, next);
			response(req, res, code, 'BUSINESS_STATUS_UPDATED', 'Business status has been updated', { business });
		}))
		.patch('/:id/hr/resend-invite/:idUser', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code } = await patchResendInvite(req, res, next);
			response(req, res, code, 'INVITE_RESENTED', 'User Invite has been resented');
		}))
		.patch('/:id/hr/:idUser', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, users } = await patchBusinessHRUser(req, res, next);
			response(req, res, code, 'BUSINESS_USER_STATUS_UPDATED', 'Business User status has been updated', { users });
		}))
		.patch('/users/:id', checkToken(), checkRole('user'), checkUserHR(), errorHandler(async (req, res, next) => {
			const { code, users } = await patchBusinessUser(req, res, next);
			response(req, res, code, 'BUSINESS_USER_STATUS_UPDATED', 'Business User status has been updated', { users });
		}))

		.delete('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, business } = await deleteBusiness(req,res,next);
			response(req, res, code, 'BUSINESS_DELETED', 'Business has been deleted', { business });
		}))
		.delete('/:id/hr/:idUser', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, users } = await deleteBusinessHRUser(req,res,next);
			response(req, res, code, 'BUSINESS_USER_DELETED', 'Business User has been deleted', { users });
		}))
		.delete('/:id/contracts/:idContract', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, contracts } = await deleteBusinessContract(req,res,next);
			response(req, res, code, 'BUSINESS_CONTRACT_DELETED', 'Business Contract has been deleted', { contracts });
		}))
		.delete('/users/:id', checkToken(), checkRole('user'), checkUserHR(), errorHandler(async (req, res, next) => {
			const { code, users } = await deleteBusinessUser(req,res,next);
			response(req, res, code, 'BUSINESS_USER_DELETED', 'Business User has been deleted', { users });
		}));
	return router;
};

export const router = businessesRouter;