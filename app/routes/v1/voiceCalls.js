// Packages
import express from 'express';
import _ from 'lodash';
import { DateTime, Duration } from 'luxon';
import twilio from 'twilio';

// Utils
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { checkToken, checkRole } from './index';
import messages from '../../utils/messages';
import config from '../../utils/config';
import Socket from '../../utils/socket';

// Models
import NotificationToken from '../../models/notificationToken';
import Call from '../../models/call';

const twilioAccount = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_ACCOUNT_AUTH_TOKEN);
const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const patchStartVoiceCall = async (req) => {
	const { headers: { source }, user } = req;

	if (source != 'app') throw errors.no_permission;

	const startDate = DateTime.utc();

	const newRoom = await twilioAccount.video.rooms.create({ 
		uniqueName: `Chamada ${user.name} | ${startDate.setZone('Europe/Lisbon').toFormat('dd-MM-yyyy HH:mm:ss')}`,
		// audioOnly: true
	});
	console.log('NEW ROOM', newRoom);

	const call = await new Call({
		user: user._id,
		business: user.businessId,
		startDate: startDate.toJSDate(),
		twilioRoom: JSON.parse(JSON.stringify(newRoom)),
	}).save();
    
	const token = new AccessToken(
		process.env.TWILIO_ACCOUNT_SID,
		process.env.TWILIO_API_KEY,
		process.env.TWILIO_API_SECRET,
		{ identity:  user.name },
	);

	const grant = new VideoGrant({
		room: call.twilioRoom.uniqueName,
	});
    
	token.addGrant(grant);

	const emitCall = await Call.findOne({ _id: call._id }).populate('user').lean();

	Socket.emit('voice-call', { type: 'new-call', record: emitCall });

	return { code: 200, userToken: token.toJwt(), twilioRoom: call.twilioRoom };
};

const patchAcceptVoiceCall = async (req) => {
	const { params: { id }, user } = req;

	const call = await Call.findOneAndUpdate({ _id: id, finished: false, $or: [{ psychologist: null }, { psychologist: user._id }] }, { psychologist: user._id, twilioPsychologistEntered: true, twilioPsychologistEnteredDate: DateTime.utc() }, { new: true }).lean();
	if (!call) throw errors.call_unavailable;
    
	const token = new AccessToken(
		process.env.TWILIO_ACCOUNT_SID,
		process.env.TWILIO_API_KEY,
		process.env.TWILIO_API_SECRET,
		{ identity:  user.externalName },
	);

	const grant = new VideoGrant({
		room: call.twilioRoom.uniqueName,
	});
    
	token.addGrant(grant);
    
	Socket.emit('voice-call', { type: 'accepted-call', record: call });

	return { code: 200, userToken: token.toJwt(), twilioRoom: call.twilioRoom };
};

const patchReviewVoiceCall = async (req) => {
	const { params: { id }, user, body: { rating } } = req;

	await Call.updateOne({ _id: id, user: user._id, psychologist: { $ne: null } }, { rating }).lean();

	return { code: 200 };
};

//Router
const voiceCallsRouter = errorHandler => {
	const router = express.Router();
	router
		.patch('/start', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { userToken, twilioRoom, code } = await patchStartVoiceCall(req,res,next);
			response(req, res, code, 'START_VOICE_CALL', 'Voice Call Start', { userToken, twilioRoom });
		}))
		.patch('/accept/:id', checkToken(), checkRole('psychologist'), errorHandler(async (req, res, next) => {
			const { userToken, twilioRoom, code } = await patchAcceptVoiceCall(req,res,next);
			response(req, res, code, 'VOICE_CALL_ACCEPTED', 'Voice Call Accepted', { userToken, twilioRoom });
		}))
		.patch('/review/:id', checkToken(), checkRole('user'), errorHandler(async (req, res, next) => {
			const { code } = await patchReviewVoiceCall(req,res,next);
			response(req, res, code, 'VOICE_CALL_REVIEWED', 'Voice Call Reviewed');
		}));
	return router;
};

export const router = voiceCallsRouter;