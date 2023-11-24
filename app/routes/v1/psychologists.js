import express from 'express';
import bcrypt from 'bcrypt';
import generator from 'generate-password';
import _ from 'lodash';
import { DateTime, Duration } from 'luxon';
import moment from 'moment';
import 'moment-recur';

import { mongoose } from '../../utils/database';
import { response } from '../../utils/misc';
import { checkToken, checkRole, formDataParser } from './index';
import { uploadImage, deleteImage } from '../../utils/upload';
import { sendEmail } from '../../utils/email';
import errors from '../../utils/errors';
import config from '../../utils/config';

import Schedule from '../../models/schedule';
import Psychologist from '../../models/psychologist';
import Consultation from '../../models/consultation';
import Call from '../../models/call';
import Notification from '../../models/notification';
import Token from '../../models/token';
import NotificationToken from '../../models/notificationToken';
import User from '../../models/user';
import Chat from '../../models/chat';

const ObjectId = mongoose.Types.ObjectId;

const getPsychologist = async (req) => {
	const { params: { id }, user } = req;
	let psychologist;
    
	if (id) {
		let psychologistId = id === 'me' ? user._id : id;
		psychologist = await Psychologist.findOne({ _id: psychologistId });
		if (!psychologist) throw errors.not_found;
		psychologist = psychologist.displayInfo();
	} else {psychologist = await Psychologist.aggregate([
		{ $project: { photo: 1, isActive: 1, isConfirmed: 1, name: 1, email: 1 } },
	]);}

	return { code: 200, psychologist };
};

const getHome = async (req, res, next) => {
	const { user, headers: { source }, params: { date } } = req;

	const currentDate = DateTime.utc().minus({ hours: 1 }).toJSDate();
	const startDate = DateTime.fromFormat(date, 'yyyy-MM-dd').startOf('day').toISO();
	const endDate = DateTime.fromFormat(date, 'yyyy-MM-dd').endOf('day').toISO();

	const [ nextConsultations, dayConsultations, pendingCalls, pendingChats ] = await Promise.all([
		Consultation.find({ psychologist: user._id, cancelled: false, startDate: { $gte: currentDate } }).sort({ startDate: 1 }).populate({ path: 'user', select: 'name photo'}).lean(),
		Consultation.find({ psychologist: user._id, startDate: { $gte: startDate, $lte: endDate } }).populate({ path: 'user', select: 'name photo'}).lean(),
		Call.find({ finished: false, $or: [{ psychologist: null }, { psychologist: user._id }] }).populate({ path: 'user', select: 'name photo'}).lean(),
		Chat.find({ finished: false, $or: [{ psychologist: null }, { psychologist: user._id }] }).populate({ path: 'user', select: 'name photo'}).lean(),
	]);

	return { code: 200, psychologist: user, nextConsultations, pendingChats, dayConsultations, pendingCalls };

};

const getPatients = async (req, res, next) => {
	const { user, params: { id, idTreatment } } = req;

	let patients;

	if (id && idTreatment) {
		patients = await User.aggregate([
			{ $match: { _id: ObjectId(id) } },
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
			{ $lookup: {
				from: 'treatments',
				let: { userId: '$_id', treatmentId: ObjectId(idTreatment) },
				pipeline: [
					{ $match: { $expr: { $and: [{ $eq: ['$$userId', '$user'] }, { $eq: ['$$treatmentId', '$_id'] }] } } },
					{ $lookup: {
						from: 'consultations',
						let: { treatmentId: '$_id' },
						pipeline: [
							{ $match: { $expr: { $eq: ['$$treatmentId', '$treatment'] } } },
							{ $project: { startDate: 1, diagnostics: 1, clinicalIntervention: 1, clinicalRecord: 1, goalsNextConsultation: 1 } },
							{ $sort: { startDate: 1 } },
						],
						as: 'consultations',
					} },
				],
				as: 'treatments',
			} },
			{ $addFields: { treatments: { $arrayElemAt: ['$treatments', 0] } } },
		]);
		if (!patients || !patients.length) throw errors.not_found;
		patients = patients[0];
	} else if (id) {
		patients = await User.aggregate([
			{ $match: { _id: ObjectId(id) } },
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
			{ $lookup: {
				from: 'treatments',
				let: { userId: '$_id' },
				pipeline: [
					{ $match: { $expr: { $eq: ['$$userId', '$user'] } } },
				],
				as: 'treatments',
			} },
		]);
		if (!patients || !patients.length) throw errors.not_found;
		patients = patients[0];
	} else {patients = await User.aggregate([
		{ $match: { psychologist: user._id } },
		{ $project: { photo: 1, name: 1 } },
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
	]);}

	return { code: 200, patients };
};

const getConsultations = async (req, res, next) => {
	const { user } = req;
	
	const currentDate = DateTime.utc().minus({ hours: 1 }).toJSDate();

	// const [ nextConsultations, pendingReport ] = await Promise.all([
	//     Consultation.find({ psychologist: user._id, cancelled: false, startDate: { $gte: currentDate } }).sort({ startDate: 1 }).populate({ path: 'user', select: 'name photo'}),
	//     Consultation.find({ psychologist: user._id, cancelled: false, finished: false, startDate: { $lt: currentDate } }).sort({ startDate: 1 }).populate({ path: 'user', select: 'name photo'})
	// ])

	const consultationsAgg = await Consultation.aggregate([
		{ $match: { psychologist: ObjectId(user._id), cancelled: false } },
		{ $facet: {
			nextConsultations: [
				{ $match: { startDate: { $gte: currentDate } } },
				{ $lookup: {
					from: 'users',
					let: { userId: '$_id' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$$userId', '$_id'] } } },
						{ $project: { name: 1, photo: 1 } },
					],
					as: 'user',
				} },
				{ $addFields: { business: { $arrayElemAt: ['$user', 0] } } },
				{ $sort: { startDate: 1 } },
			],
			pendingReport: [
				{ $match: { finished: false, startDate: { $lt: currentDate } } },
				{ $lookup: {
					from: 'users',
					let: { userId: '$_id' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$$userId', '$_id'] } } },
						{ $project: { name: 1, photo: 1 } },
					],
					as: 'user',
				} },
				{ $addFields: { business: { $arrayElemAt: ['$user', 0] } } },
				{ $sort: { startDate: 1 } },
			],
		} },
	]);

	const { nextConsultations, pendingReport } = consultationsAgg[0];

	return { code: 200, nextConsultations, pendingReport };
};

const getConsultationsPast = async (req, res, next) => {
	const { user, params } = req;

	const endDateOver = DateTime.fromFormat(params.endDate, 'yyyy-MM-dd').endOf('day') > DateTime.utc().minus({ hours: 1 });
	
	const startDate = DateTime.fromFormat(params.startDate, 'yyyy-MM-dd').startOf('day').toISO();
	const endDate = endDateOver ? DateTime.utc().minus({ hours: 1 }) : DateTime.fromFormat(params.endDate, 'yyyy-MM-dd').endOf('day').toISO();

	const pastConsultations = await Consultation.find({ psychologist: user._id, startDate: { $gte: startDate, $lte: endDate } }).populate({ path: 'user', select: 'name photo'});

	return { code: 200, pastConsultations };
};

const postPsychologist = async (req) => {
	const { body, user } = req;

	if (!body.name && !body.email) throw errors.required_fields_empty;
	if (!body.externalName) body.externalName = body.name;

	const existingPsychologist = await Psychologist.findOne({ email: body.email });
	if (existingPsychologist) throw errors.duplicate_email;

	if (body.files.length) body.photo = await uploadImage(body.files[0], 'psychologist');

	body.confirmationCode = Math.floor(Math.random() * 9000) + 1000;

	const psychologist = await Psychologist(body).save();

	await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.PSYC_WEB}/confirm-account/${psychologist.email}/${psychologist.confirmationCode}` }, psychologist.email );

	return { code: 200, psychologist };
};

const postConfirmAccount = async (req, res, next) => {
	const { params: { code }, body: { email, password }, headers: { source } } = req;
	let psychologist = await Psychologist.findOne({ email }).lean();
	if (psychologist.isConfirmed) throw errors.invalid_credentials;

	if (!email) throw errors.invalid_parameter;
	if (code && password) {
		psychologist = await Psychologist.findOneAndUpdate({ email, confirmationCode: code }, { isConfirmed: true, confirmationCode: null, password: bcrypt.hashSync(password, 10) }, { new: true }).lean();
		if (!psychologist) throw errors.not_found;
		
		const token = generator.generateMultiple(2, { length: 30, numbers: true }).toString().replace(',', '.');
		const newToken = new Token({
			psychologist: psychologist._id,
			authToken: token,
			dateExpired: DateTime.utc().plus({ days: config.tokenDuration }).toISO(),
		});
		await newToken.save();
		
		return { psychologist, token, code: 200 };
	} else if (code && !password) {
		throw errors.invalid_parameter;
	} else {
		const confirmationCode = Math.floor(Math.random() * 9000) + 1000;
		psychologist = await Psychologist.findOneAndUpdate({ email }, { confirmationCode }, { new: true }).lean();
		if (!psychologist) throw errors.not_found;
		
		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.PSYC_WEB}/confirm-account/${psychologist.email}/${confirmationCode}` }, psychologist.email );
		
		return { code: 200 };
	}
};

const postRecoverPassword = async (req, res, next) => {
	const { body, params } = req;

	let psychologist = await Psychologist.findOne({ email: body.email }).lean();
	if (!psychologist) return { code: 200 };
    
	const codeParams = params.code;
	if (!codeParams) {
		const resetCode = Math.floor(Math.random() * 9000) + 1000;
		await Psychologist.updateOne({ _id: psychologist._id }, { resetCode });
        
		await sendEmail(config.keyEmails.recoverPasswordLink, null, { ...config.emailTags, link: `${process.env.PSYC_WEB}/recover-password/${psychologist.email}/${resetCode}` }, psychologist.email);
        
		return { code: 200 };
	} else {
		psychologist = await Psychologist.findOneAndUpdate({ _id: psychologist._id, resetCode: codeParams }, { password: bcrypt.hashSync(body.password, 10), resetCode: null }).lean();
		if (!psychologist) throw errors.invalid_credentials;

		const token = generator.generateMultiple(2, { length: 30, numbers: true }).toString().replace(',', '.');
		const newToken = new Token({
			psychologist: psychologist._id,
			authToken: token,
			dateExpired: DateTime.utc().plus({ days: config.tokenDuration }).toISO(),
		});
		await newToken.save();
	
		return { code: 200, psychologist, token };
	}
};

const putPsychologistAdmin = async (req) => {
	const { body, params: { id }, user } = req;

	const existPsychologist = await Psychologist.findOne({ _id: id });

	if (body.files && body.files.length) {
		const photo = body.files.find(f => f.fieldName === 'photo');
		
		if (!!photo && user.photo) {
			await deleteImage(user.photo, 'psychologist');
			body.photo = await uploadImage(photo, 'psychologist');
		} else { body.photo = await uploadImage(photo, 'psychologist'); }
	}

	let psychologist = await Psychologist.findOneAndUpdate({ _id: id }, body, { new: true });
	psychologist = psychologist.displayInfo();
    
	return { code: 200, psychologist };
};

const putPsychologist = async (req) => {
	const { body, user } = req;

	const existPsychologist = await Psychologist.findOne({ _id: user._id });

	if (body.currentPassword && body.password) {
		if (!existPsychologist || !existPsychologist.comparePassword(body.currentPassword)) throw errors.invalid_credentials;
		
		body.password = bcrypt.hashSync(body.password, 10);
	}

	let psychologist = await Psychologist.findOneAndUpdate({ _id: user._id }, body, { new: true });
	psychologist = psychologist.displayInfo();
    
	return { code: 200, psychologist };
};

const patchPsychologist = async (req) => {
	const { params: { id }, body } = req;

	if (body.isActive == null) throw errors.required_fields_empty;
    
	await Psychologist.findOneAndUpdate({ _id: id }, { isActive: body.isActive });
    
	const psychologist = await Psychologist.find();

	return { code: 200, psychologist };
};

const patchResendInvite = async (req, res, next) => {
	const { params: { id } } = req;

	const psychologist = await Psychologist.findOne({ _id: id }).lean();

	if (!psychologist.isConfirmed && psychologist.confirmationCode)	{
		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.PSYC_WEB}/confirm-account/${psychologist.email}/${psychologist.confirmationCode}` }, psychologist.email );
	} else if (!psychologist.isConfirmed && !psychologist.confirmationCode) {
		const code = Math.floor(Math.random() * 9000) + 1000;
		
		await Psychologist.updateOne({ _id: id }, { confirmationCode: code });

		await sendEmail(config.keyEmails.confirmAccountLink, null, { ...config.emailTags, link: `${process.env.PSYC_WEB}/confirm-account/${psychologist.email}/${code}` }, psychologist.email );
	}

	return { code: 200 };
};

const deletePsychologist = async (req) => {
	const { params: { id } } = req;

	const [ existingPsychologist, existConsultations, existUser ] = await Promise.all([
		Psychologist.findOne({ _id: id }),
		Consultation.findOne({ psychologist: id }),
		User.findOne({ psychologist: id }),
	]);
    
	if (existingPsychologist && !existConsultations && !existUser) {
		console.log('ENTRE AQUI!!!');
		await Promise.all([
			Psychologist.deleteOne({ _id: id }),
			Notification.deleteMany({ psychologist: id }),
			Schedule.deleteMany({ psychologist: id }),
			Token.deleteMany({ psychologist: id }),
			NotificationToken.deleteMany({ psychologist: id }),
		]);
	} else throw errors.record_in_use;

	const psychologist = await Psychologist.find();

	return { code: 200, psychologist };
};

const searchPsychologistsSlots = async (req) => {
	const { body: { startDate: begginDate, endDate }, user } = req;

	let startDate = begginDate;
	const currentMonthDate = DateTime.utc().startOf('month').toFormat('yyyy-MM-dd');
	if (currentMonthDate === begginDate) startDate = DateTime.utc().toFormat('yyyy-MM-dd');

	// Preparing time variables
	const selectedStartDate = DateTime.fromFormat(startDate, 'yyyy-MM-dd').startOf('day').toJSDate();
	const selectedEndDate = DateTime.fromFormat(endDate, 'yyyy-MM-dd').endOf('day').toJSDate();

	const additionalQuery = user.role === 'psychologist' ? { psychologist: user._id } : user.psychologist ? { psychologist: user.psychologist } : { };

	const slotsPsychologist = await Schedule.aggregate([
		{ $match: { date: { $gte: selectedStartDate, $lte: selectedEndDate }, ...additionalQuery } },
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
		{ $addFields: { endDate: { $add: ['$date', 86399999 ] } } },
		{ $lookup: {
			from: 'consultations',
			let: { psychologistId: '$psychologist', startDate: '$date', endDate: '$endDate' },
			pipeline: [
				{ $match: { $expr: {
					$and: [
						{ $eq: ['$$psychologistId', '$psychologist'] },
						{ $gte: ['$startDate', '$$startDate'] },
						{ $lte: ['$endDate', '$$endDate'] },
						{ $eq: ['$cancelled', false] },
					],
				} } },
				{ $project: { psychologist: 1, startDate: 1, endDate: 1 } },
			],
			as: 'consultations',
		} },
		{ $group: {
			_id: '$date',
			slots: { $push: { slots: '$slots', psychologist: '$psychologist', consultations: '$consultations' } },
		} },
		{ $unwind: '$slots' },
		{ $unwind: '$slots' },
		{ $group: {
			_id: '$_id',
			slots: { $push: '$slots' },
		} },
		{ $sort: { _id: 1 } },
	]);

	const minuteMS = 60000;
	const dayMS = 86400000;

	let slotsAvailable = [];
    
	let minMS = 0;
	const todayDate = DateTime.utc().startOf('day').toFormat('yyyy-MM-dd');
	const todayMS = DateTime.utc().plus({ hours: 1 }).toFormat('HH:mm');
	const todayHourMS = Duration.fromISOTime(todayMS).toMillis();
    
	slotsPsychologist.forEach(slotAvailable => {
		const { slots, _id } = slotAvailable;
		const slotRange = 60;
		const date = DateTime.fromJSDate(_id).toFormat('yyyy-MM-dd');
		if (date === todayDate) {
			minMS = todayHourMS;
		} else minMS = 0;

		let slotsDayAvailable = [];
		let newRecord = {
			date: _id,
		};

		slots.forEach(generalSlot => {
			const { slots: psicSlots, consultations } = generalSlot;
            
			let slotsOccupied = [];
			//Evaluate consultations slots occupied
			if (consultations.length) {
				consultations.forEach(consultation => {
					const { startDate, endDate } = consultation;

					const start = DateTime.fromJSDate(startDate, { zone: 'Europe/Lisbon' }).minus({ minutes: 30 });
					const end = DateTime.fromJSDate(endDate, { zone: 'Europe/Lisbon' });
					const duration = end.diff(start, ['hours']).toObject();
					const startHour = Duration.fromISOTime(start.toFormat('HH:mm'));
					const numSlots = duration.hours * 2;

					for (let index = 0; index < numSlots; index++) {
						const toAdd = { minutes: index * 30 };
						const timeSlot = startHour.plus(toAdd);
						slotsOccupied.push(timeSlot.toFormat('hh:mm'));
					}
				});
			}
            
			psicSlots.forEach(timeSlot => {
				const range = (timeSlot.end - timeSlot.start) / 1000;
				const rangeMinutes = range / 60;
				let totalSlots = rangeMinutes / slotRange;
                
				for (let index = 0; index < totalSlots; index++) {
					const slot = Duration.fromMillis((timeSlot.start + (index * slotRange * minuteMS) % dayMS));
					if (minMS === 0 || (minMS > 0 && slot.toMillis() >= minMS))
					{slotsDayAvailable.push(slot.toFormat('hh:mm'));}
				}
			});
            
            
			if (slotsOccupied.length) {
				slotsDayAvailable = slotsDayAvailable.filter(slot => !slotsOccupied.includes(slot));
			}
		});
        
		newRecord.slots = slotsDayAvailable
			.sort((s1, s2) => Duration.fromISOTime(s1).toMillis() - Duration.fromISOTime(s2).toMillis())
			.filter((value, index, self) => self.indexOf(value) === index);

		slotsAvailable.push(newRecord);
	});

	return { code: 207, slots: slotsAvailable };
};

const getSchedule = async (req) => {
	const { params: { id, startDate, endDate } } = req;

	const schedules = await Schedule.find({ psychologist: id, date: { $gte: DateTime.fromFormat(startDate, 'yyyy-MM-dd').toISO(), $lte: DateTime.fromFormat(endDate, 'yyyy-MM-dd').toISO() } }).lean();

	return { code: 200, schedules };
};

const saveSchedule = async (req) => {
	const { params: { id, startDate, endDate }, body: { schedules } } = req;

	if (!id || !startDate || !endDate || !schedules) throw errors.required_fields_empty;

	if (schedules.length > 7) throw errors.invalid_parameter;
	let newSchedules = [];

	await Schedule.deleteMany({ psychologist: id, date: { $gte: DateTime.fromFormat(startDate, 'yyyy-MM-dd').toISO(), $lte: DateTime.fromFormat(endDate, 'yyyy-MM-dd').toISO() } });
	if (schedules.length > 0) newSchedules = await Schedule.insertMany(schedules);

	return { code: 200, schedules: newSchedules };
};

const createRecurrSchedule = async (req) => {
	const { params: { id }, body } = req;
	const { date, start, end, recurringEnd, _id: idSlot } = body;
	const psychologists = await Schedule.find({ psychologist: id, date: { $gte: DateTime.fromFormat(date, 'yyyy-MM-dd').toISO(), $lte: DateTime.fromFormat(recurringEnd, 'yyyy-MM-dd').toISO() } });

	const recurrDates = moment().recur(date, recurringEnd).every(1, 'weeks');
	const arrayDates = recurrDates.all('YYYY-MM-DD');
	if (arrayDates.length && arrayDates[0] === date) arrayDates.shift();
	console.log('ARRAY DATES', arrayDates);
	if (arrayDates.length) {
		for (const recurrDate of arrayDates) {
			// recurrDate = DateTime.fromFormat(recurrDate, 'yyyy-MM-dd').startOf('day').toJSDate();
			console.log('RECURR DATE', recurrDate);
			const existSchedule = psychologists.find(schedule => {
				const scheduleDate = DateTime.fromJSDate(schedule.date).toFormat('yyyy-MM-dd').toString();
				if (scheduleDate == recurrDate) return schedule;
			});
			console.log('EXISTE SCHED', existSchedule);
			if (!existSchedule) {
				// CREATE NEW SCHEDULE
				const newSchedule = {
					psychologist: id,
					date: DateTime.fromFormat(recurrDate, 'yyyy-MM-dd').startOf('day').toJSDate(),
					slots: [{
						recurring: true,
						recurringEnd: recurringEnd,
						recurringOriginSlot: idSlot,
						start: start,
						end: end,
					}],
				};

				console.log('VOU CRIAR UMA NOVA', newSchedule);
				await new Schedule(newSchedule).save();
			} else {
				let slots = [{
					recurring: true,
					recurringEnd: recurringEnd,
					recurringOriginSlot: idSlot,
					start: start,
					end: end,
				}];

				for (const existSlot of existSchedule.slots) {
					if (start >= existSlot.start && end <= existSlot.end) {
						console.log('SHOULD SPLIT');
						slots.push({
							start: existSlot.start,
							end: start,
						});
						slots.push({
							start: end,
							end: existSlot.end,
						});
					} else if ((existSlot.start >= start && start <= existSlot.end) || (end >= existSlot.start && existSlot.end <= end)) {
						if (existSlot.start >= start && existSlot.end <= end) {
							console.log('DONT DO ANYTHING');
						} else {
							if (start >= existSlot.start) {
								const diffStart = existSlot.end - start;
								if (diffStart > 0) {
									slots.push({
										start: existSlot.start,
										end: existSlot.end - diffStart,
									});
								}
							}
    
							if (end <= existSlot.end) {
								const diffEnd = end - existSlot.start;
								if (diffEnd > 0) {
									slots.push({
										start: existSlot.start + diffEnd,
										end: existSlot.end,
									});
								}
							}
						}
					} else slots.push(existSlot);
				}
				console.log('SLOTS', slots);
				await Schedule.updateOne({ _id: existSchedule._id }, { slots });
			}
		};
		await Schedule.updateOne({ psychologist: id, 'slots._id': idSlot }, { $set: { 'slots.$.recurring': true, 'slots.$.recurringEnd': recurringEnd, 'slots.$.recurringOriginSlot': idSlot }});
	}

	return { code: 200 };
};

const deleteRecurrSchedule = async (req) => {
	const { params: { id, idSlot, date } } = req;
	await Promise.all([
		Schedule.deleteMany({ psychologist: id, 'slots.recurringOriginSlot': idSlot, date: { $gt: DateTime.fromFormat(date, 'yyyy-MM-dd').toISO() }, slots: { $size: 1 } }),
		Schedule.updateMany({ psychologist: id, 'slots.recurringOriginSlot': idSlot, date: { $gt: DateTime.fromFormat(date, 'yyyy-MM-dd').toISO() }, slots: { $size: 2 } }, { $pull: { slots: { recurringOriginSlot: idSlot }} }),
	]);

	return { code: 200 };
};

const psychologistsRouter = (errorHandler) => {
	const router = express.Router();

	router
		.get('/:id/schedules/:startDate/:endDate', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { schedules, code } = await getSchedule(req, res, next);
			response(req, res, code, 'SCHEDULE_FOUND', 'Found Schedules', { schedules });
		}))
		.get('/home/:date', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code, psychologist, nextConsultations, pendingChats, dayConsultations, pendingCalls } = await getHome(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_HOME_FOUND', 'Psychologist Home Found', { psychologist, nextConsultations, pendingChats, dayConsultations, pendingCalls });
		}))
		.get('/patients/:id?/:idTreatment?', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code, patients } = await getPatients(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_PATIENTS_FOUND', 'Psychologist Patients Found', { patients });
		}))
		.get('/consultations', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code, nextConsultations, pendingReport } = await getConsultations(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_CONSULTATIONS_FOUND', 'Psychologist Consultations Found', { nextConsultations, pendingReport });
		}))
		.get('/past-consultations/:startDate/:endDate', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code, pastConsultations } = await getConsultationsPast(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_CONSULTATIONS_FOUND', 'Psychologist Consultations Found', { pastConsultations });
		}))
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin', 'psychologist'), errorHandler(async (req, res, next) => {
			const { code, psychologist } = await getPsychologist(req,res,next);
			response(req, res, code, 'PSYCOLOGIST_FOUND', 'Psychologist found', { psychologist });
		}))
        
		.post('/search-slots', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { slots, code } = await searchPsychologistsSlots(req, res, next);
			response(req, res, code, 'SCHEDULE_SLOTS_FOUND', 'Found Schedule Schedules', { slots });
		}))
		.post('/confirm/:code', errorHandler(async (req, res, next) => {
			const { code, psychologist, token } = await postConfirmAccount(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_CONFIRMED', 'Psychologist has been confirmed', { psychologist, token });
		}))
		.post('/recover-password/:code?', errorHandler(async (req, res, next) => {
			const { code, psychologist, token } = await postRecoverPassword(req, res, next);
			response(req, res, code, 'PASSWORD_RESET', 'Psychologist password reset', { psychologist, token });
		}))
		.post('/', checkToken(), formDataParser(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, psychologist } = await postPsychologist(req,res,next);
			response(req, res, code, 'PSYCOLOGIST_CREATED', 'Psychologist has been created', { psychologist });
		}))
        
        
		.put('/:id/schedules/:startDate/:endDate', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { schedules, code } = await saveSchedule(req, res, next);
			response(req, res, code, 'SCHEDULE_CREATED', 'Schedules have been created', { schedules });
		}))
		.put('/:id', checkToken(), formDataParser(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, psychologist } = await putPsychologistAdmin(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_UPDATED', 'Psychologist has been updated', { psychologist });
		}))
		.put('/', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { code, psychologist } = await putPsychologist(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_UPDATED', 'Psychologist has been updated', { psychologist });
		}))

		.patch('/:id/schedules/recurrent', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code } = await createRecurrSchedule(req, res, next);
			response(req, res, code, 'RECURR_SCHEDULE_CREATED', 'Recurrent Schedules have been created');
		}))
		.patch('/resend-invite/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code } = await patchResendInvite(req, res, next);
			response(req, res, code, 'INVITE_RESENTED', 'Staff Invite has been resented');
		}))
		.patch('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, psychologist } = await patchPsychologist(req, res, next);
			response(req, res, code, 'PSYCOLOGIST_STATUS_UPDATED', 'Psychologist status has been updated', { psychologist });
		}))

		.delete('/:id/schedules/slot/:idSlot/date/:date', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code } = await deleteRecurrSchedule(req, res, next);
			response(req, res, code, 'RECURR_SCHEDULE_DELETED', 'Schedules have been deleted');
		}))
		.delete('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, psychologist } = await deletePsychologist(req,res,next);
			response(req, res, code, 'PSYCOLOGIST_DELETED', 'Psychologist has been deleted', { psychologist });
		}));
	return router;
};

export const router = psychologistsRouter;
