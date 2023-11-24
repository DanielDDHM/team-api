// Packages
import express from 'express';
import { DateTime } from 'luxon';
import bcrypt from 'bcrypt';
import generator from 'generate-password';
import _ from 'lodash';

//Utils
import { mongoose } from '../../utils/database';
import { checkToken, checkRole, formDataParser } from './index';
import { response } from '../../utils/misc';
import { uploadImage, deleteImage } from '../../utils/upload';
import { sendEmail } from '../../utils/email';
import errors from '../../utils/errors';
import config from '../../utils/config';

// Model
import User from '../../models/user';
import Token from '../../models/token';
import Notification from '../../models/notification';
import Business from '../../models/business';
import Mood from '../../models/mood';
import Library from '../../models/library';
import LibraryCategory from '../../models/libraryCategory';
import Consultation from '../../models/consultation';
import Treatment from '../../models/treatment';

const ObjectId = mongoose.Types.ObjectId;

const getUser = async (req, res, next) => {
	const { params: { id } } = req;

	let userId = id === 'me' ? req.user._id : id;

	const user = await User.findOne({ _id: userId }).select('-password').lean();
	if (!user) throw errors.not_found;

	user.storeLinks = config.storeLinks;

	return { code: 200, user };
};

const getHome = async (req, res, next) => {
	const { user, headers: { source } } = req;

	const currentDate = DateTime.utc().minus({ hours: 1 }).toJSDate();

	if (source === 'app') {
		const [ existUser, library, libraryCategories, nextConsultation, reviewTreatment ] = await Promise.all([
			User.aggregate([
				{ $match: { _id: user._id } },
				{ $project: { password: 0 } },
				{ $lookup: {
					from: Mood.collection.name,
					let: { userId: '$_id' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$user', '$$userId'] } } },
						{ $sort: { date: -1 } },
						{ $limit: 10 },
						{ $project: { user: 0, _id: 0 } },
					],
					as: 'mood',
				} },
			]),
			Library.aggregate([
				{ $match: { published: true, $or: [{ businesses: ObjectId(user.businessId) }, { businesses: { $size: 0 } }] } },
				{ $sort: { _created: -1 } },
				{ $lookup: {
					from: 'librarycategories',
					let: { categoryId: '$category' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$$categoryId', '$_id'] } } },
						{ $project: { type: 1, name: 1 } },
					],
					as: 'category',
				} },
				{ $addFields: { category: { $arrayElemAt: ['$category', 0] } } },
				{ $limit: 5 },
			]),
			LibraryCategory.find().lean(),
			Consultation.findOne({ user: user._id, cancelled: false, startDate: { $gte: currentDate } }).sort({ startDate: 1 }).populate({ path: 'psychologist', select: 'name externalName photo'}),
			Treatment.findOne({ user: user._id, clinicalDischarge: { $ne: null }, reviewed: false }).select('startDate clinicalDischarge').lean(),
		]);
		if (!existUser.length) throw errors.not_found;
		
		existUser[0].business = user.business;
		
		return { code: 200, user: existUser[0], library, libraryCategories, nextConsultation, reviewTreatment };
	} else {
		const [ nextConsultation, reviewTreatment ] = await Promise.all([
			Consultation.find({ user: user._id, cancelled: false, startDate: { $gte: currentDate } }).sort({ startDate: 1 }).populate({ path: 'psychologist', select: 'name externalName photo'}),
			Treatment.findOne({ user: user._id, clinicalDischarge: { $ne: null }, reviewed: false }).select('startDate clinicalDischarge').lean(),
		]);

		return { code: 200, user: user, nextConsultation, reviewTreatment };
	}

};

const getLibrary = async (req, res, next) => {
	const { user } = req;
	
	const library = await Library.aggregate([
		{ $match: { published: true, $or: [{ businesses: ObjectId(user.businessId) }, { businesses: { $size: 0 } }] } },
		{ $lookup: {
			from: 'librarycategories',
			let: { categoryId: '$category' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$categoryId', '$_id'] } } },
				{ $project: { name: 1, type: 1 } },
			],
			as: 'category',
		} },
		{ $addFields: { category: { $arrayElemAt: ['$category', 0] } } },
		{ $group: { _id: '$category', library: { $push: {
			_id: '$_id',
			name: '$name',
			type: '$type',
			description: '$description',
			image: '$image',
			video: '$video',
			audio: '$audio',
			surveyQuestions: '$surveyQuestions',
			surveyResults: '$surveyResults',
		} } } },
		{ $project: { category: '$_id', library: 1 } },
		{ $sort: { 'category._id': 1, 'library._created': -1 } },
		{ $project: { _id: 0 } },
	]);

	return { code: 200, library };
};

const getConsultations = async (req, res, next) => {
	const { user } = req;
	
	const currentDate = DateTime.utc().minus({ hours: 1 }).toJSDate();

	const nextConsultations = await Consultation.find({ user: user._id, cancelled: false, startDate: { $gte: currentDate } }).sort({ startDate: 1 }).populate({ path: 'psychologist', select: 'name externalName photo'});

	return { code: 200, nextConsultations };
};

const getConsultationsPast = async (req, res, next) => {
	const { user, params } = req;

	const endDateOver = DateTime.fromFormat(params.endDate, 'yyyy-MM-dd').endOf('day') > DateTime.utc().minus({ hours: 1 });
	
	const startDate = DateTime.fromFormat(params.startDate, 'yyyy-MM-dd').startOf('day').toJSDate();
	const endDate = endDateOver ? DateTime.utc().minus({ hours: 1 }).toJSDate() : DateTime.fromFormat(params.endDate, 'yyyy-MM-dd').endOf('day').toJSDate();

	const pastConsultations = await Consultation.find({ user: user._id, startDate: { $gte: startDate, $lte: endDate } }).populate({ path: 'psychologist', select: 'name externalName photo'});

	return { code: 200, pastConsultations };
};

const getMood = async (req, res, next) => {
	const { user, params } = req;
	
	const startDate = DateTime.fromFormat(params.startDate, 'yyyy-MM-dd').startOf('day').toJSDate();
	const endDate = DateTime.fromFormat(params.endDate, 'yyyy-MM-dd').endOf('day').toJSDate();

	const moods = await Mood.find({ user: user._id, date: { $gte: startDate, $lte: endDate } }).select('date mood');

	return { code: 200, moods };
};

const postUsersSearch = async (req, res, next) => {
	const { perPage, page, search, sort, filters } = req.body;

	const num = Number(perPage || 100);
	const pageNum = Number(page || 0);

	const userQuery = {};

	if (search && search.length) {
		const regex = new RegExp(search, 'i');
		const searchQuery = [];

		searchQuery.push({ name: { $regex: regex } });
		searchQuery.push({ email: { $regex: regex } });
		searchQuery.push({ phone: { $regex: regex } });

		userQuery.$or = searchQuery;
	}

	const availableBooleanFilters = ['isActive'];
	const availableTextFilters = ['name', 'email', 'phone'];

	if (filters && Object.keys(filters).length) {
		userQuery.$and = [];
		for (const fil in filters) {
			const regex = new RegExp(filters[fil], 'i');
			if (availableBooleanFilters.includes(fil)) {
				userQuery.$and.push({ [fil]: filters[fil] });
			} else if (availableTextFilters.includes(fil)) {
				userQuery.$and.push({ [fil]: { $regex: regex } });
			} else {
				userQuery.$and.push({ [fil]: { $regex: regex } });
			}
		}
	}

	const sortQuery = {};
	if (sort) {
		sortQuery.field = sort.split(' ')[0];
		sortQuery.asc = sort.split(' ')[1] === 'asc' ? 1 : -1;
	}

	const [ total, users ] = await Promise.all([
		User.countDocuments(userQuery),
		User.find(userQuery).select('-password').sort({ [sortQuery.field]: sortQuery.asc }).skip(num * pageNum).limit(num).lean(),
	]);

	return { code: 200, users, total };
};

const postSurvey = async (req, res, next) => {
	const { user, params: { id }, body } = req;

	const existSurvey = await Library.findOne({ _id: id, type: 'survey' }).lean();
	if (!existSurvey || (existSurvey && (!existSurvey.surveyQuestions.length || !existSurvey.surveyResults.length))) throw errors.no_permission;

	let score = 0;
	body.forEach(answer => {
		const existQuestion = existSurvey.surveyQuestions.find(question => String(question._id) === String(answer.questionId));
		if (!existQuestion) throw errors.invalid_parameter;
		const existAnswer = existQuestion.answers.find(ans => String(ans._id) === String(answer.answerId));
		if (!existAnswer) throw errors.invalid_parameter;
		score += existAnswer.value;
	});
	
	console.log('SCORE', score);
	const existScore = existSurvey.surveyResults.find(values => score >= values.minValue && score <= values.maxValue);
	if (!existScore) throw errors.invalid_parameter;

	const result = {
		result: existScore.result,
		description: existScore.description,
	};

	await Library.updateOne({ _id: existSurvey._id }, { $push: { surveyAnswers: { user: user._id, score, date: DateTime.utc(), ...result } } });

	return { code: 200, result };
};

const postConfirmUser = async (req, res, next) => {
	const { params: { code }, body: { email, password }, headers: { source } } = req;
	let user = await User.findOne({ email }).lean();
	if (!user || (user && user.isConfirmed)) throw errors.invalid_credentials;

	if (!email) throw errors.invalid_parameter;
	if (code && password) {
		user = await User.findOneAndUpdate({ email, confirmationCode: code }, { isConfirmed: true, confirmationDate: DateTime.utc().toJSDate(), confirmationCode: null, password: bcrypt.hashSync(password, 10) }, { new: true }).lean();
		if (!user) throw errors.not_found;
		const business = await Business.aggregate([
			{ $project: { name: 1, users: 1, logo: 1, isActive: 1 } },
			{ $match: { isActive: true, users: { $elemMatch: { user: ObjectId(user._id), isActive: true } } } },
			{ $project: { name: 1, user: {
				$filter: {
					input: '$users',
					as: 'user',
					cond: {
						$eq: [ '$$user.user', ObjectId(user._id) ],
					},
				},
			} } },
			{ $unwind: '$user' },
			{ $project: { name: 1, role: '$user.role', logo: 1 } },
		]);
		if (!business) throw errors.not_found;
		user.business = business[0].name;
		user.businessId = business[0]._id;
		user.businessLogo = business[0].logo;
		user.isHR = business[0].role === 'hr';
		
		const token = generator.generateMultiple(2, { length: 30, numbers: true }).toString().replace(',', '.');
		const newToken = new Token({
			user: user._id,
			authToken: token,
			dateExpired: DateTime.utc().plus({ days: config.tokenDuration }).toISO(),
		});
		await newToken.save();
		
		return { user, token, code: 200 };
	} else if (code && !password) {
		user = await User.findOne({ email, confirmationCode: code }).lean();
		if (!user) throw errors.not_found;
		const business = await Business.findOne({ users: { $elemMatch: { user: user._id, isActive: true } } }).select('name').lean();
		if (!business) throw errors.not_found;

		return { code: 200, user };
	} else {
		const confirmationCode = Math.floor(Math.random() * 9000) + 1000;
		user = await User.findOneAndUpdate({ email }, { confirmationCode }, { new: true }).lean();
		if (!user) throw errors.not_found;
		const business = await Business.findOne({ isActive: true, users: { $elemMatch: { user: user._id, isActive: true } } }).select('name').lean();
		if (!business) throw errors.not_found;
		
		if (source === 'app') {
			await sendEmail(config.keyEmails.confirmAccountCode, null, { ...config.emailTags, code: confirmationCode}, user.email );
			return { code: 200, user };
		} else {
			await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/confirm-account/${user.email}/${confirmationCode}` }, user.email );
			return { code: 200 };
		}
	}
};

const putUpdateUser = async function (req, res, next) {
	const { body, params: { id }, user } = req;
	if (id != user._id) throw errors.no_permission;

	const existUser = await User.findOne({ _id: id });

	if (body.files && body.files.length) {
		const photo = body.files.find(f => f.fieldName === 'photo');
		
		if (!!photo && user.photo) {
			await deleteImage(user.photo, 'users');
			body.photo = await uploadImage(photo, 'users');
		} else { body.photo = await uploadImage(photo, 'users'); }
	}

	if (body.currentPassword && body.password) {
		if (!existUser || !existUser.comparePassword(body.currentPassword)) throw errors.invalid_credentials;
		
		body.password = bcrypt.hashSync(body.password, 10);
	}

	let updatedUser = await User.findOneAndUpdate({ _id: id }, body, { new: true });

	updatedUser = updatedUser.displayInfo();
	updatedUser.business = user.business;
	updatedUser.businessId = user.businessId;
	updatedUser.isHR = user.isHR;
	
	return { code: 200, user: updatedUser };
};

const postSupport = async function (req, res, next) {
	const { body: { subject, message }, user } = req;

	const text = `O utilizador com o email ${user.email} enviou um pedido de contacto através da app, com o seguinte conteudo:<br>Assunto:${subject}<br>Mensagem:<br>${message}`;

	await sendEmail(config.keyEmails.generalEmail, 'Pedido de Suporte', { ...config.emailTags, title: 'Pedido de Contacto', text });

	return { code: 200 };
};

const postRecoverPassword = async (req, res, next) => {
	const { body, params, headers: { source } } = req;

	const codeParams = params.code;
	let user = {};

	user = await User.findOne({ email: body.email }).lean();
	if (!user) return { code: 200 };
	const business = await Business.findOne({ isActive: true, users: { $elemMatch: { user: user._id, isActive: true } } }).select('name').lean();
	if (!business) throw errors.not_found;

	if (!codeParams) {
		const resetCode = Math.floor(Math.random() * 9000) + 1000;
		await User.updateOne({ email: body.email }, { resetCode });

		if (source === 'app') {
			await sendEmail(config.keyEmails.recoverPasswordCode, null, { ...config.emailTags, code: resetCode }, user.email);
			return { code: 200, resetCode };
		} else {
			await sendEmail(config.keyEmails.recoverPasswordLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/recover-password/${user.email}/${resetCode}` }, user.email);
			return { code: 200 };
		}
	} else if (codeParams && !body.password) {
		user = await User.findOne({ email: body.email, resetCode: codeParams });
		if (!user) throw errors.not_found;

		return { code: 200, user: user.displayInfo() };
	} else {
		const password = bcrypt.hashSync(body.password, 10);
		user = await User.findOneAndUpdate({ _id: user._id, resetCode: codeParams }, { password, resetCode: null });
		if (!user) throw errors.invalid_credentials;

		const business = await Business.aggregate([
			{ $project: { name: 1, users: 1, isActive: 1 } },
			{ $match: { isActive: true, users: { $elemMatch: { user: ObjectId(user._id), isActive: true } } } },
			{ $project: { name: 1, user: {
				$filter: {
					input: '$users',
					as: 'user',
					cond: {
						$eq: [ '$$user.user', ObjectId(user._id) ],
					},
				},
			} } },
			{ $unwind: '$user' },
			{ $project: { name: 1, role: '$user.role' } },
		]);
		if (!business) throw errors.not_found;

		user = user.displayInfo();
		user.business = business[0].name;
		user.businessId = business[0]._id;
		user.isHR = business[0].role === 'hr';

		const token = generator.generateMultiple(2, { length: 30, numbers: true }).toString().replace(',', '.');
		const newToken = new Token({
			user: user._id,
			authToken: token,
			dateExpired: DateTime.utc().plus({ days: config.tokenDuration }).toISO(),
		});
		await newToken.save();
	
		return { code: 200, token, user };
	}
};

const postChangeEmail = async (req, res, next) => {
	const { body: { newEmail, password }, params: { code }, headers: { source }, user } = req;

	if (!code) {
		if (!newEmail) throw errors.invalid_parameter;

		const [ existEmail, currentUser ] = await Promise.all([
			User.findOne({ email: newEmail }),
			User.findOne({ _id: user._id }),
		]);
		if (existEmail) throw errors.duplicate_email;
		
		if (password && (!currentUser || !currentUser.comparePassword(password))) throw errors.invalid_credentials;

		const changeEmailCode = Math.floor(Math.random() * 9000) + 1000;
		await User.updateOne({ _id: user._id }, { changeEmailCode, newEmail });

		if (source === 'app') {
			await sendEmail(config.keyEmails.changeEmailCode, null, { ...config.emailTags, code: changeEmailCode }, newEmail);
			return { code: 200, changeEmailCode };
		} else {
			await sendEmail(config.keyEmails.changeEmailLink, null, { ...config.emailTags, link: `${process.env.USER_WEB}/profile/${changeEmailCode}` }, newEmail);
			return { code: 200 };
		}
	} else {
		const existUser = await User.findOne({ _id: user._id, changeEmailCode: code }).lean();
		if (!existUser) throw errors.invalid_credentials;

		let updatedUser = await User.findOneAndUpdate({ _id: user._id, changeEmailCode: code }, { email: user.newEmail, newEmail: null, changeEmailCode: null }, { new: true });

		updatedUser = updatedUser.displayInfo();
		updatedUser.business = user.business;
		updatedUser.businessId = user.businessId;
		updatedUser.isHR = user.isHR;
	
		return { code: 200, user: updatedUser };
	}
};

const getNotifications = async (req) => {
	const { user } = req;

	if (!user) return { code: 200, notifications: [] };

	const notifications = await Notification.find({ user: user._id })
		.select('-user -staff')
		.populate({ path: 'order', select: '_id orderNumber' })
		.sort({ _created: -1 })
		.lean();

	await Notification.updateMany({ user: user._id, read: false }, { read: true });

	return { code: 200, notifications };
};

const patchMood = async (req) => {
	const { user, body: { mood } } = req;

	const moodDate = DateTime.utc().startOf('day');
	const existMood = await Mood.findOne({ date: moodDate, user: user._id }).lean();
	if (existMood) throw errors.duplicate_entry;

	await new Mood({ date: moodDate, user: user._id, mood: mood }).save();

	const [ existUser, business ] = await Promise.all([
		User.aggregate([
			{ $match: { _id: user._id } },
			{ $project: { password: 0 } },
			{ $lookup: {
				from: Mood.collection.name,
				let: { userId: '$_id' },
				pipeline: [
					{ $match: { $expr: { $eq: ['$user', '$$userId'] } } },
					{ $sort: { date: -1 } },
					{ $limit: 10 },
					{ $project: { user: 0, _id: 0 } },
				],
				as: 'mood',
			} },
		]),
		Business.findOne({ users: { $elemMatch: { user: user._id, isActive: true } } }).select('name').lean(),
	]);
	if (!existUser.length || !business) throw errors.not_found;

	existUser[0].business = business.name;

	return { code: 200, user: existUser[0] };
};

const patchReview = async (req) => {
	const { user, body, params: { type, id } } = req;

	if (!type && !id) throw errors.missing_fields;
	
	if (type === 'treatment') {
		const { general, psychologist, pontuality, consultationNumbers, willBack, recomendation, motivation, balance, keepService, notes } = body;
		if (!general && !psychologist && !pontuality && !consultationNumbers && !willBack && !recomendation && !motivation && !balance && !keepService) throw errors.missing_fields;

		const review = { general, psychologist, pontuality, consultationNumbers, willBack, recomendation, motivation, balance, keepService, notes };
		const existTreatment = await Treatment.findOneAndUpdate({ _id: id, user: user._id }, { reviewed: true, review }).lean();
		if (!existTreatment) throw errors.missing_fields;
	}

	return { code: 200 };
};

const deleteNotification = async (req) => {
	const { user, params: { id } } = req;

	await Notification.deleteOne({ _id: id });

	const notifications = await Notification.find({ user: user._id })
		.select('-user -staff')
		.populate({ path: 'order', select: '_id orderNumber' })
		.sort({ _created: -1 })
		.lean();

	return { code: 200, notifications };
};

const usersRouter = (errorHandler) => {
	const router = express.Router();
	router
		.get('/notifications', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, notifications } = await getNotifications(req, res, next);
			response(req, res, code, 'NOTIFICATIONS_FOUND', 'Found Notifications', { notifications });
		}))
		.get('/home', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, user, library, libraryCategories, nextConsultation, reviewTreatment } = await getHome(req, res, next);
			response(req, res, code, 'USER_HOME_FOUND', 'User Home Found', { user, library, libraryCategories, nextConsultation, reviewTreatment });
		}))
		.get('/library', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, library } = await getLibrary(req, res, next);
			response(req, res, code, 'USER_LIBRARY_FOUND', 'User Library Found', { library });
		}))
		.get('/consultations', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, nextConsultations } = await getConsultations(req, res, next);
			response(req, res, code, 'USER_CONSULTATIONS_FOUND', 'User Consultations Found', { nextConsultations });
		}))
		.get('/past-consultations/:startDate/:endDate', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, pastConsultations } = await getConsultationsPast(req, res, next);
			response(req, res, code, 'USER_CONSULTATIONS_FOUND', 'User Consultations Found', { pastConsultations });
		}))
		.get('/mood/:startDate/:endDate', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, moods } = await getMood(req, res, next);
			response(req, res, code, 'USER_HOME_FOUND', 'User Home Found', { moods });
		}))
		.get('/:id?', checkToken(), errorHandler(async (req, res, next) => {
			const { code, user } = await getUser(req, res, next);
			response(req, res, code, 'USERS_FOUND', 'Found Users', { user });
		}))
		
		.post('/support', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code } = await postSupport(req, res, next);
			response(req, res, code, 'SUPPORT_SENT', 'Support Sent');
		}))
		.post('/survey/:id', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, result } = await postSurvey(req, res, next);
			response(req, res, code, 'USER_SURVEY_FOUND', 'User Survey Found', { result });
		}))
		.post('/search', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, users, total } = await postUsersSearch(req, res, next);
			response(req, res, code, 'USERS_FOUND', 'Found Users', { users, total });
		}))
		.post('/recover-password/:code?', errorHandler(async (req, res, next) => {
			const { code, resetCode, token, user } = await postRecoverPassword(req, res, next);
			if (req.headers.source === 'app') {
				response(req, res, code, 'PASSWORD_RESET', 'User password reset', { resetCode, token, user });
			} else {
				response(req, res, code, 'PASSWORD_RESET', 'User password reset', { token, user });
			}
		}))
		.post('/change-email/:code?', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, changeEmailCode, user } = await postChangeEmail(req, res, next);
			if (req.headers.source === 'app') {
				response(req, res, code, 'USER_EMAIL_CHANGE', 'User E-mail change', { user, changeEmailCode });
			} else {
				response(req, res, code, 'USER_EMAIL_CHANGE', 'User E-mail change', { user });
			}
		}))
		.post('/confirm/:code?', errorHandler(async (req, res, next) => {
			const { code, user, token } = await postConfirmUser(req, res, next);
			response(req, res, code, 'USER_CONFIRMED', 'User has been confirmed', { user, token });
		}))
		
		.put('/:id', checkToken(), checkRole('user'), formDataParser(), errorHandler(async (req, res, next) => {
			const { code, user } = await putUpdateUser(req, res, next);
			response(req, res, code, 'USER_UPDATED', 'User has been updated', { user });
		}))
		
		.patch('/mood', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, user } = await patchMood(req, res, next);
			response(req, res, code, 'USER_MOOD_ADDED', 'User Mood Added', { user });
		}))
		.patch('/review/:type/:id', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code } = await patchReview(req, res, next);
			response(req, res, code, 'USER_REVIEW_ADDED', 'User Review Added');
		}))

		.delete('/notification/:id', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code, notifications } = await deleteNotification(req, res, next);
			response(req, res, code, 'NOTIFICATIONS_FOUND', 'Found Notifications', { notifications });
		}));
	return router;
};

export const router = usersRouter;
