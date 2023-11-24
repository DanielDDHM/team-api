// Packages
import express from 'express';
import _ from 'lodash';
import { DateTime, Duration } from 'luxon';
import twilio from 'twilio';

// Utils
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { checkToken, checkRole } from './index';
import { sendNotifs } from '../../utils/notifications';
import { sendEmail } from '../../utils/email';
import messages from '../../utils/messages';
import config from '../../utils/config';
import Socket from '../../utils/socket';

// Models
import Consultation from '../../models/consultation';
import Call from '../../models/call';
import NotificationToken from '../../models/notificationToken';

const twilioAccount = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_ACCOUNT_AUTH_TOKEN);
const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const postIncomingStatusRoom = async (req, res, next) => {
	const { body: { RoomSid, RoomName, RoomStatus, StatusCallbackEvent, ParticipantIdentity } } = req;

	console.log('-------------');
	console.log('TWILIO STATUS ROOM');
	console.log('-------------');
	console.log('BODY: ', req.body);

	if (RoomName.split(' ')[0] != 'Chamada') {
		const consultation = await Consultation.findOne({ 'twilioRoom.sid': RoomSid }).select('user psychologist twilioRoom twilioUserEntered twilioPsychologistEntered').populate({ path: 'user', select: 'name email' }).populate({ path: 'psychologist', select: 'name externalName email' }).lean();
		if (!consultation) return { code: 200 };
		const { user, psychologist, twilioUserEntered, twilioPsychologistEntered } = consultation;
		if (ParticipantIdentity) {
			if (ParticipantIdentity === user.name) req.body.user = true;
			if (ParticipantIdentity === psychologist.name) req.body.psychologist = true;
		}
        
		if (RoomStatus === 'completed') {
			await Consultation.updateOne({ 'twilioRoom.sid': RoomSid }, { twilioRoom: null, $push: { twilioStatus: req.body } });
		} else if (RoomStatus === 'in-progress') {
			if (StatusCallbackEvent === 'participant-connected') {
				const participantName = ParticipantIdentity;
				if (!twilioUserEntered && participantName === user.name) {
					const notifications = await NotificationToken.aggregate([
						{ $match: { psychologist: psychologist._id } },
						{
							$group: {
								_id: '$language',
								ios: { $addToSet: { $cond: [{ $eq: ['$device', 'ios'] }, '$token', null] } },
								android: { $addToSet: { $cond: [{ $eq: ['$device', 'android'] }, '$token', null] } },
								web: { $addToSet: { $cond: [{ $eq: ['$device', 'web'] }, '$token', null] } },
							},
						},
						{ $project: { _id: 1, web: { $setDifference: ['$web', [null]] }, ios: { $setDifference: ['$ios', [null]] }, android: { $setDifference: ['$android', [null]] } } },
					]);
                    
					const title = messages.consultationVideoStarted.title;
					const message = messages.consultationVideoStarted.message(user.name, 'user');
    
					for (const notification of notifications) {
						const { _id: lang, web, ios, android } = notification;
						sendNotifs({ web, android, ios, title: title[lang], message: message[lang ? lang : 'pt'], data: { notifType: 'consultation', consultationId: consultation._id }, link: `${process.env.WEB_URL}/psychologist/profile?consultation=${consultation._id}` });
					}
    
					await Promise.all([
						// sendEmail(config.keyEmails.consultationPsychologistEmail, title.pt, { text: message.pt, link: `${process.env.WEB_URL}/psychologist/profile?consultation=${consultation._id}` }, psychologist.email),
						Consultation.updateOne({ 'twilioRoom.sid': RoomSid }, { 'twilioRoom.status': RoomStatus, twilioUserEntered: true, twilioUserEnteredDate: DateTime.utc(), $push: { twilioStatus: req.body } }),
					]);
    
				} else if (!twilioPsychologistEntered && participantName === psychologist.name) {
					//ENVIAR EMAIL E NOTIF AO USER
					const notifications = await NotificationToken.aggregate([
						{ $match: { user: user._id } },
						{
							$group: {
								_id: '$language',
								ios: { $addToSet: { $cond: [{ $eq: ['$device', 'ios'] }, '$token', null] } },
								android: { $addToSet: { $cond: [{ $eq: ['$device', 'android'] }, '$token', null] } },
								web: { $addToSet: { $cond: [{ $eq: ['$device', 'web'] }, '$token', null] } },
							},
						},
						{ $project: { _id: 1, web: { $setDifference: ['$web', [null]] }, ios: { $setDifference: ['$ios', [null]] }, android: { $setDifference: ['$android', [null]] } } },
					]);
                    
					const title = messages.consultationVideoStarted.title;
					const message = messages.consultationVideoStarted.message(psychologist.name, 'psychologist');
    
					for (const notification of notifications) {
						const { _id: lang, web, ios, android } = notification;
						sendNotifs({ web, android, ios, title: title[lang], message: message[lang ? lang : 'pt'], data: { notifType: 'consultation', consultationId: consultation._id }, link: `${process.env.WEB_URL}/profile?consultation=${consultation._id}` });
					}
    
					await Promise.all([
						// sendEmail(config.keyEmails.consultationUserEmail, title.pt, { text: message.pt, link: `${process.env.WEB_URL}/profile?consultation=${consultation._id}` }, user.email),
						Consultation.updateOne({ 'twilioRoom.sid': RoomSid }, { 'twilioRoom.status': RoomStatus, twilioPsychologistEntered: true, twilioPsychologistEnteredDate: DateTime.utc(), $push: { twilioStatus: req.body } }),
					]);
				}
    
			} else await Consultation.updateOne({ 'twilioRoom.sid': RoomSid }, { 'twilioRoom.status': RoomStatus, $push: { twilioStatus: req.body } });
    
		} else await Consultation.updateOne({ 'twilioRoom.sid': RoomSid }, { 'twilioRoom.status': RoomStatus, $push: { twilioStatus: req.body } });
	} else {
		const call = await Call.findOne({ 'twilioRoom.sid': RoomSid }).select('user psychologist twilioRoom twilioUserEntered twilioPsychologistEntered').populate({ path: 'user', select: 'name email' }).populate({ path: 'psychologist', select: 'name externalName email' }).lean();
		if (!call) return { code: 200 };
		const { user, psychologist } = call;

		if (ParticipantIdentity) {
			if (ParticipantIdentity === user.name) req.body.user = true;
			if (psychologist && ParticipantIdentity === psychologist.name) req.body.psychologist = true;
		}

		let updateCall = { $push: { twilioStatus: req.body } };
		if (req.body.user && (StatusCallbackEvent === 'participant-disconnected' || StatusCallbackEvent === 'room-ended')) {
			updateCall.finished = true;
			Socket.emit('voice-call', { type: 'accepted-call', record: call });
		}
        
		await Call.updateOne({ 'twilioRoom.sid': RoomSid }, updateCall);
	}

	return { code: 200 };
};

const getConsultationVideo = async (req) => {
	const { params: { id }, headers: { source }, user } = req;
    
	// const timeAllowed = DateTime.utc().plus({ minutes: 5 }).toISO();
	// let consultation = await Consultation.findOne({ _id: id, startDate: { $lte: timeAllowed } }).populate('user psychologist').lean();
	// if (!consultation) throw errors.no_permission;
    
	let consultation = await Consultation.findOne({ _id: id }).populate('user psychologist').lean();

	if (!consultation.twilio || (consultation.twilio && consultation.twilio.roomStatus === 'completed')) {
		const localDate = DateTime.fromJSDate(consultation.startDate).setZone('Europe/Lisbon').toFormat('dd-MM-yyyy HH:mm');
		try {
			const newRoom = await twilioAccount.video.rooms.create({ 
				uniqueName: `Consulta ${consultation.user.name} | ${consultation.psychologist.externalName} | ${localDate}`,
			});
			console.log('NEW ROOM', newRoom);
			consultation = await Consultation.findOneAndUpdate({ _id: id }, { $set: { twilioRoom: JSON.parse(JSON.stringify(newRoom)) } }, { new: true });
		} catch (error) {
			if (error.code === 53113) {
				let existingRoom;
				await twilioAccount.video.rooms(`Consulta ${consultation.user.name} | ${consultation.psychologist.externalName} | ${localDate}`).fetch().then(room => {
					console.log('EXIST ROOM', JSON.parse(JSON.stringify(room)));
					existingRoom = JSON.parse(JSON.stringify(room));
				});
				consultation = await Consultation.findOneAndUpdate({ _id: id }, { $set: { twilioRoom: existingRoom } }, { new: true });
			}
		}
	}
    
	const token = new AccessToken(
		process.env.TWILIO_ACCOUNT_SID,
		process.env.TWILIO_API_KEY,
		process.env.TWILIO_API_SECRET,
		{ identity:  source != 'psyc' ? user.name : user.externalName },
	);

	const grant = new VideoGrant({
		room: consultation.twilioRoom.uniqueName,
	});
    
	token.addGrant(grant);

	return { code: 200, userToken: token.toJwt(), twilioRoom: consultation.twilioRoom };
};

//Router
const videoCallsRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/consultation/:id', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { userToken, twilioRoom, code } = await getConsultationVideo(req,res,next);
			response(req, res, code, 'CONSULTATIONS_VIDEO_START', 'Consultation Video Start', { userToken, twilioRoom });
		}))
        
		.post('/room-status', errorHandler(async (req, res) => {
			const { code } = await postIncomingStatusRoom(req);
			response(req, res, code, 'ROOM_STATUS_NOTIFIED', 'Room Status Notified');
		}));
	return router;
};

export const router = videoCallsRouter;