// Packages
import express from 'express';
import _ from 'lodash';
import { DateTime, Duration } from 'luxon';

// Utils
import { mongoose } from '../../utils/database';
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { checkToken, checkRole } from './index';
import { sendNotifs } from '../../utils/notifications';
import { sendEmail } from '../../utils/email';
import messages from '../../utils/messages';
import config from '../../utils/config';

// Models
import Schedule from '../../models/schedule';
import Consultation from '../../models/consultation';
import Notification from '../../models/notification';
import NotificationToken from '../../models/notificationToken';
import User from '../../models/user';
import Business from '../../models/business';
import Treatment from '../../models/treatment';

const ObjectId = mongoose.Types.ObjectId;

const saveConsultation = async (consultation) => {
	const lastConsultation = await Consultation.findOne().select('consultationNumber').sort({ consultationNumber: -1 }).lean();
	const consultationNumber = lastConsultation ? Number(lastConsultation.consultationNumber) + 1 : 1;
	consultation.consultationNumber = consultationNumber.toString().padStart(6, '0');

	try {
		await consultation.save();
	} catch (error) {
		if (error.code === 11000) {
			return saveConsultation(consultation);
		} else {
			console.log('ERROR: ', error);
			throw errors.internal_error;
		}
	}
};

const validatePsicAvailable = async(startDay, start, end, startDate, endDate, psychologist) => {

	const endDay = startDay.endOf('day');
	const addMatch = psychologist ? { psychologist: psychologist } : { };
	const psychologists = await Schedule.aggregate([
		{ $match: { 
			date: startDay.toJSDate(), 
			'slots.start': { $lte: start },
			'slots.end': { $gte: end },
			...addMatch,
		} },
		{ $lookup: {
			from: 'psychologists',
			let: { psychologistId: '$psychologist' },
			pipeline: [
				{ $match: { $expr: {
					$and: [
						{ $eq: ['$$psychologistId', '$_id'] },
						{ $eq: ['$isConfirmed', true] },
						{ $eq: ['$isActive', true] },
					],
				} } },
				{ $project: { _id: 1 } },
			],
			as: 'psychologist',
		} },
		{ $unwind: '$psychologist' },
		{ $addFields: { psychologist: '$psychologist._id' } },
		{ $lookup: {
			from: 'consultations',
			let: { psychologistId: '$psychologist' },
			pipeline: [
				{ $match: { $expr: {
					$and: [
						{ $eq: ['$$psychologistId', '$psychologist'] },
						{ $gte: ['$startDate', startDate.toJSDate()] },
						{ $lte: ['$endDate', endDate.toJSDate()] },
						{ $eq: ['$cancelled', false] },
					],
				} } },
				{ $project: { _id: 1 } },
			],
			as: 'consultations',
		} },
		{ $match: { consultations: { $size: 0 } } },
		{ $lookup: {
			from: 'consultations',
			let: { psychologistId: '$psychologist' },
			pipeline: [
				{ $match: { $expr: {
					$and: [
						{ $eq: ['$$psychologistId', '$psychologist'] },
						{ $gte: ['$startDate', startDay.toJSDate()] },
						{ $lte: ['$endDate', endDay.toJSDate()] },
						{ $eq: ['$cancelled', false] },
					],
				} } },
				{ $project: { _id: 1 } },
			],
			as: 'consultationsDay',
		} },
		{ $addFields: { totalConsultations: { $size: '$consultationsDay' } } },
		{ $sort: { totalConsultations: 1 } },
		// { $group: { _id: null, psychologists: { $push: '$psychologist' } } }
	]);
	console.log('PSYCOLOGIST', psychologists);
    
	if (!psychologists || !psychologists.length) return null;


	return psychologists[0].psychologist;
};

const getConsultation = async (req) => {
	const { params: { id } } = req;
    
	const consultation = await Consultation.findOne({ _id: id }).populate('psychologist user');

	return { code: 200, consultation };
};

const getConsultationReport = async (req) => {
	const { params: { id } } = req;
    
	const consultation = await Consultation.aggregate([
		{ $match: { _id: ObjectId(id), finished: false } },
		{ $lookup: {
			from: 'treatments',
			let: { userId: '$user' },
			pipeline: [
				{ $match: { $expr: { $and: [{ $eq: ['$$userId', '$user'] }, { $eq: ['$clinicalDischarge', null] }] } } },
			],
			as: 'treatment',
		} },
		{ $lookup: {
			from: 'users',
			let: { userId: '$user' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$userId', '$_id'] } } },
				{ $project: { name: 1, externalName: 1, photo: 1, phone: 1, email: 1, birthdate: 1 } },
				{ $lookup: {
					from: 'businesses',
					let: { userId: '$_id' },
					pipeline: [
						{ $unwind: '$users' },
						{ $match: { $expr: { $eq: ['$$userId', '$users.user'] } } },
					],
					as: 'business',
				} },
				{ $addFields: { business: { $arrayElemAt: ['$business.name', 0] } } },
			],
			as: 'user',
		} },
		{ $addFields: { 
			user: { $arrayElemAt: ['$user', 0] },
			treatment: { $arrayElemAt: ['$treatment', 0] },
		} },
	]);

	console.log('CONSULTATION', consultation);

	if (!consultation || !consultation.length) throw errors.not_found;

	return { code: 200, consultation: consultation[0] };
};

const postConsultationsSearch = async (req, res, next) => {
	const { body } = req;
	const { perPage, page, search, exportData } = body;
	let { filters } = body;

	const num = Number(perPage || 10);
	const pageNum = Number(page || 0);

	//PROCURA TEXTO GERAL
	let userQuery = {};

	if (search && search.length) {
		const regex = new RegExp(search, 'i');

		//QUERYS DE TEXTO (INCLUSIVÉ TABELAS ASSOCIADAS)
		userQuery.$or = [
			{ 'user.email': { $regex: regex } },
			{ 'psychologist.name': { $regex: regex } },
			{ 'business.name': { $regex: regex } },
		];
	}

	if (filters && filters.length) {
		//FILTROS DE DATAS OU TEXTOS OU BOOLEANS
		userQuery.$and = filters.map(filter => {
			const regex = new RegExp(filter.query, 'i');
			switch (filter.field) {	
			case 'userName': return { 'user.name': { $regex: regex } };
			case 'psychologistName': return { 'psychologist.name': { $regex: regex } };
			case 'business': return { 'business._id': ObjectId(filter.query) };
			case 'psychologist': return { 'psychologist._id': ObjectId(filter.query) };
			case 'clientName': return { 'business.name': { $regex: regex } };
			default: return { };
			}
		});
	}

	const exportMatch = !exportData ? [{ $skip: num * pageNum }, { $limit: num }] : [{ $match: {} }];

	const query = await Consultation.aggregate([
		{ $project: { user: 1, psychologist: 1, business: 1, consultationNumber: 1, startDate: 1, duration: 1, cancelled: 1 } },
		{ $lookup: {
			from: 'psychologists',
			let: { psychologistId: '$psychologist' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$psychologistId', '$_id'] } } },
			],
			as: 'psychologist',
		} },
		{ $lookup: {
			from: 'businesses',
			let: { businessId: '$business' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$businessId', '$_id'] } } },
			],
			as: 'business',
		} },
		{ $lookup: {
			from: 'users',
			let: { userId: '$user' },
			pipeline: [
				{ $match: { $expr: { $eq: ['$$userId', '$_id'] } } },
			],
			as: 'user',
		} },
		{ $addFields: { 
			psychologist: { $arrayElemAt: ['$psychologist', 0] },
			business: { $arrayElemAt: ['$business', 0] },
			user: { $arrayElemAt: ['$user', 0] },
		} },
		{ $match: userQuery },
		{
			$facet: {
				consultations: [
					{ $sort: { startDate: -1 } },
					...exportMatch,
				],
				total: [{ $count: 'count' }],
			},
		},
	]);

	const consultations = query[0].consultations;
	const total = query[0].total[0] ? query[0].total[0].count : 0;

	return { code: 200, consultations, total };
};

const postConsultation = async (req, res, next) => {
	const { body: { date, time }, user } = req;
	if (!date || !time) throw errors.missing_fields;
    
	const businessAgg = await Business.aggregate([
		{ $match: { isActive: true, users: { $elemMatch: { user: ObjectId(user._id), isActive: true } } } },
		{ $project: { consultationsPerUser: 1 } },
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
			consultationsBought: { $cond: [ { $eq: ['$contracts', null] }, 0, '$contracts.count' ] },
			consultationsUsed: { $cond: [ { $eq: ['$consultations', null] }, 0, '$consultations.count' ] },
			consultationsPerUser: 1,
		} },
	]);
	const business = businessAgg[0] || null;
	if (!business) throw errors.not_found;
	if (business.consultationsUsed >= business.consultationsBought) throw errors.exceed_business_consultations;

	const duration = 45;

	const dateStartDay = DateTime.fromFormat(date, 'yyyy-MM-dd').startOf('day');
	const dateUtc = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: 'Europe/Lisbon' }).startOf('day');
	const startTime = Duration.fromISOTime(time).toMillis();
	const endTime = Duration.fromISOTime(time + duration).toMillis();
	const startDate = dateUtc.plus({ milliseconds: startTime });
	const endDate = dateUtc.plus({ milliseconds: startTime, minutes: duration });

	if (business.consultationsPerUser > 0) {
		const userConsultations = await Consultation.countDocuments({ user: user._id, startDate: { $gte: dateUtc.startOf('month').toJSDate(), $lte: dateUtc.endOf('month').toJSDate() } });
		if (userConsultations >= business.consultationsPerUser) throw errors.exceed_consultations;
	}

	// CHECK BEST PSIC
	if (user.psychologist) {
		const psychologist = await validatePsicAvailable(dateStartDay, startTime, endTime, startDate, endDate, user.psychologist);
		if (!psychologist) throw errors.duplicate_entry;
	} else {
		const psychologist = await validatePsicAvailable(dateStartDay, startTime, endTime, startDate, endDate);
		if (!psychologist) throw errors.invalid_parameter;
		console.log('PSIC', psychologist);
		await User.updateOne({ _id: user._id }, { psychologist: psychologist });
		user.psychologist = psychologist;
	}
    
	const newConsultation = new Consultation({
		user: user._id,
		psychologist: user.psychologist,
		business: business._id,
		startDate: startDate.toISO(),
		endDate: endDate.toISO(),
		duration,
	});

	console.log('NEW CONSULTATION: ', newConsultation);

	await saveConsultation(newConsultation);
	const consultation = await Consultation.findOne({ _id: newConsultation._id }).populate({ path: 'psychologist', select: '_id name photo'});

	return { code: 200, consultation };
};

const postConsultationReport = async (req) => {
	const { params: { id }, body: { diagnostics, medication, medicationDescription, goals, anamnesis, clinicalDischarge, nextConsultationDate, nextConsultationTime, clinicalIntervention, clinicalRecord, goalsNextConsultation, birthdate, externalName }, user } = req;

	const existConsultation = await Consultation.findOne({ _id: id, psychologist: user._id, finished: false }).populate('user').lean();
	if (!existConsultation) throw errors.not_found;

	let newConsultation;

	if (nextConsultationDate && nextConsultationTime) {
		const businessAgg = await Business.aggregate([
			{ $match: { isActive: true, users: { $elemMatch: { user: ObjectId(existConsultation.user._id), isActive: true } } } },
			{ $project: { consultationsPerUser: 1 } },
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
				consultationsBought: { $cond: [ { $eq: ['$contracts', null] }, 0, '$contracts.count' ] },
				consultationsUsed: { $cond: [ { $eq: ['$consultations', null] }, 0, '$consultations.count' ] },
				consultationsPerUser: 1,
			} },
		]);
		const business = businessAgg[0] || null;
		if (business) {
			const duration = 45;
    
			const dateStartDay = DateTime.fromFormat(nextConsultationDate, 'yyyy-MM-dd').startOf('day');
			const dateUtc = DateTime.fromFormat(nextConsultationDate, 'yyyy-MM-dd', { zone: 'Europe/Lisbon' }).startOf('day');
			const startTime = Duration.fromISOTime(nextConsultationTime).toMillis();
			const endTime = Duration.fromISOTime(nextConsultationTime + duration).toMillis();
			const startDate = dateUtc.plus({ milliseconds: startTime });
			const endDate = dateUtc.plus({ milliseconds: startTime, minutes: duration });

			let consultationValidated = true;

			if (business.consultationsUsed >= business.consultationsBought) consultationValidated = false;
			if (business.consultationsPerUser > 0) {
				const userConsultations = await Consultation.countDocuments({ user: user._id, startDate: { $gte: dateUtc.startOf('month').toJSDate(), $lte: dateUtc.endOf('month').toJSDate() } });
				if (userConsultations >= business.consultationsPerUser) consultationValidated = false;
			}
            
			if (consultationValidated) {
				const psychologist = await validatePsicAvailable(dateStartDay, startTime, endTime, startDate, endDate, user._id);
				if (!psychologist) throw errors.duplicate_entry;
                
				newConsultation = new Consultation({
					user: existConsultation.user._id,
					psychologist: user._id,
					business: business._id,
					startDate: startDate.toISO(),
					endDate: endDate.toISO(),
					duration,
				});
			}
		}
	}

	let treatment = await Treatment.findOne({ user: existConsultation.user._id, clinicalDischarge: null });
	if (!treatment) {
		if (!goals || !anamnesis || !diagnostics || !diagnostics.length) throw errors.missing_fields;
		treatment = new Treatment({
			user: existConsultation.user._id,
			diagnostics: diagnostics,
			startDate: existConsultation.startDate,
			medication: medication,
			medicationDescription: medicationDescription,
			goals: goals,
			anamnesis: anamnesis,
			clinicalDischarge: clinicalDischarge ? existConsultation.endDate : null,
		});

		const updateConsultation = {
			treatment: treatment._id,
			diagnostics,
			clinicalIntervention,
			clinicalRecord,
			goalsNextConsultation,
			nextConsultation: newConsultation ? newConsultation._id : null,
			finished: true,
		};

		if (newConsultation) {
			await Promise.all([
				treatment.save(),
				Consultation.updateOne({ _id: id }, updateConsultation),
				saveConsultation(newConsultation),
			]);
		} else {
			await Promise.all([
				treatment.save(),
				Consultation.updateOne({ _id: id }, updateConsultation),
			]);
		}
	} else {
		const updateTreatment = {
			diagnostics: diagnostics,
			medication: medication,
			medicationDescription: medicationDescription,
			goals: goals,
			anamnesis: anamnesis,
			clinicalDischarge: clinicalDischarge ? existConsultation.endDate : null,
		};

		const updateConsultation = {
			treatment: treatment._id,
			diagnostics,
			clinicalIntervention,
			clinicalRecord,
			goalsNextConsultation,
			nextConsultation: newConsultation ? newConsultation._id : null,
			finished: true,
		};

		if (newConsultation) {
			await Promise.all([
				Consultation.updateOne({ _id: id }, updateConsultation),
				Treatment.updateOne({ _id: treatment._id }, updateTreatment),
				saveConsultation(newConsultation),
			]);
		} else {
			await Promise.all([
				Consultation.updateOne({ _id: id }, updateConsultation),
				Treatment.updateOne({ _id: treatment._id }, updateTreatment),
			]);
		}
	}

	if (birthdate || externalName) {
		const updateUser = {
			birthdate: birthdate ? DateTime.fromFormat(birthdate, 'yyyy-MM-dd') : null,
			externalName: externalName,
		};
		await User.updateOne({ _id: existConsultation.user._id }, updateUser);
	}

	return { code: 200 };
};

const patchRescheduleConsultation = async (req) => {
	const { body: { date, time }, params: { id }, user } = req;

	if (!date || !time || !id) throw errors.missing_fields;

	const duration = 45;

	const existConsultation = await Consultation.findOne({ _id: id, user: user._id, finished: false }).lean();
	if (!existConsultation) throw errors.invalid_parameter;
	console.log('CONSULTATION: ', existConsultation);

	const cancelPaidLimit = DateTime.utc().plus({ hours: 1 }).toJSDate();
	console.log('DATES: ', cancelPaidLimit, existConsultation.startDate);
	if (cancelPaidLimit > existConsultation.startDate) throw errors.no_permission;

	const dateStartDay = DateTime.fromFormat(date, 'yyyy-MM-dd').startOf('day');
	const dateUtc = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: 'Europe/Lisbon' }).startOf('day');
	const startTime = Duration.fromISOTime(time).toMillis();
	const endTime = Duration.fromISOTime(time + duration).toMillis();
	const startDate = dateUtc.plus({ milliseconds: startTime });
	const endDate = dateUtc.plus({ milliseconds: startTime, minutes: existConsultation.duration });

	const isAvailable = await validatePsicAvailable(dateStartDay, startTime, endTime, startDate, endDate, existConsultation.psychologist);
	if (!isAvailable) throw errors.duplicate_entry;
    
	const updatedConsultation = {
		startDate: startDate.toISO(),
		endDate: endDate.toISO(),
	};

	const consultation = await Consultation.findOneAndUpdate({ _id: existConsultation._id }, { $set: updatedConsultation }, { new: true }).populate({ path: 'user', select: '_id email'}).populate({ path: 'psychologist', select: '_id email name photo'}).lean();

	// const notifications = await NotificationToken.aggregate([
	//     { $match: { psychologist: consultation.psychologist._id } },
	//     {
	//         $group: {
	//             _id: '$language',
	//             ios: { $addToSet: { $cond: [{ $eq: ['$device', 'ios'] }, '$token', null] } },
	//             android: { $addToSet: { $cond: [{ $eq: ['$device', 'android'] }, '$token', null] } },
	//             web: { $addToSet: { $cond: [{ $eq: ['$device', 'web'] }, '$token', null] } },
	//         }
	//     },
	//     { $project: { _id: 1, web: { $setDifference: ['$web', [null]] }, ios: { $setDifference: ['$ios', [null]] }, android: { $setDifference: ['$android', [null]] } } }
	// ]);
    
	// const currentDay = DateTime.fromJSDate(existConsultation.startDate).setZone('Europe/Lisbon').toFormat('dd-MM-yyyy HH:mm');
	// const newDay = DateTime.fromJSDate(consultation.startDate).setZone('Europe/Lisbon').toFormat('dd-MM-yyyy HH:mm');
	// const title = messages.consultationChangeDate.title;
	// const message = messages.consultationChangeDate.message(currentDay, newDay);

	// for (const notification of notifications) {
	//     const { _id: lang, web, ios, android } = notification;
	//     sendNotifs({ web, android, ios, title: title[lang ? lang : 'pt'], message: message[lang], data: { notifType: 'consultation', consultationId: consultation._id }, link: `${process.env.PSYC_WEB}/psychologists/appointments` });
	// }
	// const newNotif = new Notification({ psychologist: consultation.psychologist._id, title, message, consultation: consultation._id });
    
	// await Promise.all([
	//     sendEmail(config.keyEmails.consultationUserEmail, title.pt, { text: message.pt }, consultation.psychologist.email),
	//     newNotif.save()
	// ])

	return { code: 200, consultation };
};

const patchCancelConsultation = async (req) => {
	const { params: { id }, headers: { source }, user } = req;

	const existConsultation = await Consultation.findOne({ _id: id }).lean();
	if (!existConsultation) throw errors.invalid_parameter;

	const cancelPaidLimit = DateTime.utc().minus({ hours: 1 }).toJSDate();
	let cancelledPaid = false;
	if (existConsultation.startDate < cancelPaidLimit) cancelledPaid = true;

	const updatedObject = { cancelled: true, cancelledBy: user.role, cancelledDate: DateTime.utc(), cancelledPaid };
	const consultation = await Consultation.findOneAndUpdate({ _id: existConsultation._id }, { $set: updatedObject }, { new: true }).populate({ path: 'user', select: '_id email'}).populate({ path: 'psychologist', select: '_id email'}).lean();

	// const match = user.role === 'user' ? { psychologist: consultation.psychologist._id } : { $or: [{ user: consultation.user._id }, { psychologist: consultation.psychologist._id }] };
	// const notifications = await NotificationToken.aggregate([
	//     { $match: match },
	//     {
	//         $group: {
	//             _id: '$language',
	//             ios: { $addToSet: { $cond: [{ $eq: ['$device', 'ios'] }, '$token', null] } },
	//             android: { $addToSet: { $cond: [{ $eq: ['$device', 'android'] }, '$token', null] } },
	//             web: { $addToSet: { $cond: [{ $eq: ['$device', 'web'] }, '$token', null] } },
	//         }
	//     },
	//     { $project: { _id: 1, web: { $setDifference: ['$web', [null]] }, ios: { $setDifference: ['$ios', [null]] }, android: { $setDifference: ['$android', [null]] } } }
	// ]);
    
	// const consultationDate = DateTime.fromJSDate(consultation.startDate).setZone('Europe/Lisbon').toFormat('dd-MM-yyyy HH:mm');
	// const title = messages.consultationCancelled.title;
	// const message = messages.consultationCancelled.message(consultationDate);

	// for (const notification of notifications) {
	//     const { _id: lang, web, ios, android } = notification;
	//     sendNotifs({ web, android, ios, title: title[lang], message: message[lang ? lang : 'pt'], data: { notifType: 'consultation', consultationId: consultation._id } });
	// }

	// if (user.role === 'user') {
	//     const newNotif = new Notification({ psychologist: consultation.psychologist._id, title, message, consultation: consultation._id });
	//     await Promise.all([
	//         sendEmail(config.keyEmails.consultationAssociateEmail, title.pt, { text: message.pt, link: `${process.env.PSYC_WEB}/${user.role === 'user' ? 'profile' : 'psychologist/profile'}?consultation=${consultation._id}` }, consultation.user.email),
	//         newNotif.save()
	//     ])
	// }

	return { code: 200, consultation };
};

//Router
const consultationsRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { consultation, code } = await getConsultation(req,res,next);
			response(req, res, code, 'CONSULTATIONS_FOUND', 'Consultations found', { consultation });
		}))
		.get('/:id/report', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { consultation, code } = await getConsultationReport(req,res,next);
			response(req, res, code, 'CONSULTATIONS_FOUND', 'Consultations found', { consultation });
		}))
        
		.post('/', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { consultation, code } = await postConsultation(req,res,next);
			response(req,res,code, 'CONSULTATION_CREATED', 'Consultation has been created', { consultation });
		}))
		.post('/:id/report', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code } = await postConsultationReport(req,res,next);
			response(req, res, code, 'CONSULTATIONS_REPORT_CREATED', 'Consultations Report Created');
		}))
		.post('/search', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { consultations, total, code } = await postConsultationsSearch(req, res, next);
			response(req, res, code, 'CONSULTATIONS_FOUND', 'Found Consultations', { consultations, total } );
		}))

		.patch('/:id/cancel', checkToken(), checkRole('user', 'sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { consultation, code } = await patchCancelConsultation(req,res,next);
			response(req,res,code, 'CONSULTATION_CANCELLED', 'Consultation has been cancelled', { consultation });
		}))
		.patch('/:id/reschedule', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { consultation, code } = await patchRescheduleConsultation(req,res,next);
			response(req,res,code, 'CONSULTATION_RESCHEDULED', 'Consultation has been rescheduled', { consultation });
		}))
	;

	return router;
};

export const router = consultationsRouter;