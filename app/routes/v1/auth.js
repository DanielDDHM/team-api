// Packages
import express from 'express';
import { DateTime } from 'luxon';
import generator from 'generate-password';
import jwt from 'jsonwebtoken';
import _ from 'lodash';

//Utils
import { checkToken, checkRole, formDataParser } from './index';
import { mongoose } from '../../utils/database';
import { response } from '../../utils/misc';
import { sendEmail } from '../../utils/email';
import errors from '../../utils/errors';
import config from '../../utils/config';

//Models
import Token from '../../models/token';
import Staff from '../../models/staff';
import User from '../../models/user';
import Psychologist from '../../models/psychologist';
import Business from '../../models/business';
import Invite from '../../models/invite';
import NotificationToken from '../../models/notificationToken';

const ObjectId = mongoose.Types.ObjectId;

const auth = async (req, res, next) => {
	const { body, headers: { source, origin, domain } } = req;
	const isBO = source === 'bo', isAPP = source === 'app', isWEB = source === 'web', isPSY = source === 'psyc';
	let user;
	let business;
	
	if (isBO) {
		user = await Staff.findOne({ email: body.email });
	} else if (isPSY) {
		user = await Psychologist.findOne({ email: body.email });
	} else {
		user = await User.findOne({ email: body.email });
		if (!user) throw errors.invalid_credentials;
		business = await Business.aggregate([
			{ $project: { name: 1, users: 1, logo: 1, isActive: 1 } },
			{ $match:  { isActive: true, users: { $elemMatch: { user: ObjectId(user._id), isActive: true } } } },
			{ $project: { name: 1, logo: 1, user: {
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
		if (business.length) business = business[0];
		if (!business) throw errors.not_found;
	}

	if (user && user.isConfirmed && body.password && !user.comparePassword(body.password)) {
		throw errors.invalid_credentials;
	}
	
	if (user && body.password && !user.isConfirmed) {
		if (!isBO) {
			throw errors.not_confirmed;
		} else {
			const [invite, owner] = await Promise.all([
				Invite.findOne({ staff: user._id }).populate('staff from'),
				Staff.findOne({ role: 'owner' }),
			]);

			if (invite)	{
				await sendEmail(config.keyEmails.confirmStaffLink, null, { ...config.emailTags, staff_name: invite.from.name, staff_email: invite.from.email, link: `${process.env.BO_URL}/accept-invite/${invite._id}/${invite.invitationCode}` }, invite.staff.email );
			} else {
				let business = null;
				if (user.role === 'business') {
					const existBusiness = await Business.findOne({ users: { $elemMatch: { staff: user._id, confirmed: false } } }).lean();
					if (existBusiness) business = existBusiness._id;
				}
				const code = Math.floor(Math.random() * 9000) + 1000;

				const invite = await Invite({ business: business, staff: user._id, from: owner._id, invitationCode: code }).save();
				
				await sendEmail(config.keyEmails.confirmStaffLink, null, { ...config.emailTags, staff_name: owner.name, staff_email: owner.email, link: `${process.env.BO_URL}/accept-invite/${invite._id}/${invite.invitationCode}` }, invite.staff.email );
			}

			return { status: 400, code: 'USER_NOT_CONFIRMED', message: 'Utilizador não confirmado, enviámos um email, de modo a que possa concluir o processo de confirmação' };
		}
	}

	if (!user) throw errors.invalid_credentials;

	const token = generator.generateMultiple(2, { length: 30, numbers: true }).toString().replace(',', '.');
	const newToken = new Token({
		user: !isBO && !isPSY ? user._id : null,
		staff: isBO ? user._id : null,
		psychologist: !isBO && isPSY ? user._id : null,
		authToken: token,
		dateExpired: DateTime.utc().plus({ days: config.tokenDuration }).toISO(),
	});
	await newToken.save();
	
	user = user.displayInfo();

	if (business) {
		user.business = business.name;
		user.businessId = business._id;
		user.businessLogo = business.logo;
		user.isHR = business.role === 'hr';
	}

	return { status: 200, code: 'LOGIN_SUCCESS', message: 'Login Success', user, token };
};

const signOut = async (req, res, next) => {
	console.log('ENTREI AQUI', req.headers);
	const { notiftoken } = req.headers;
	let token = req.headers['authorization'];
	token = token.split(' ');

	console.log('NOTIF TOKEN', notiftoken);
	await Promise.all([
		NotificationToken.deleteOne ({ token: notiftoken }),
		Token.deleteOne({ authToken: token[1] }),
	]);
	req.user = null;

	return { code: 200 };
};

const postNotificationToken = async (req, res, next) => {
	const { body: { notificationToken, device, language }, user } = req;

	if (!notificationToken) return { code: 200 };

	const updatedToken = {
		user: user.role === 'user' ? user._id : null,
		psychologist: user.role === 'psychologist' ? user._id : null,
		token: notificationToken,
		device: device,
		language: language ? language : 'pt',
	};

	await NotificationToken.findOneAndUpdate({ token: notificationToken }, updatedToken, { upsert: true });

	return { code: 200 };
};

const authRouter = (errorHandler) => {
	const router = express.Router();
	router
		.post('/login', errorHandler(async (req, res, next) => {
			const { code, status, message, ...responseObj } = await auth(req, res, next);
			response(req, res, status, code, message, responseObj);
		}))
		.post('/logout', errorHandler(async (req, res, next) => {
			const { code } = await signOut(req, res, next);
			response(req, res, code, 'LOGGED_OUT', 'Logged Out');
		}))
		.post('/notif-token', checkToken(), checkRole('user', 'psychologist'), errorHandler(async (req, res, next) => {
			const { code } = await postNotificationToken(req, res, next);
			response(req, res, code, 'NOTIFICATION_TOKEN_ADDED', 'Notification Token Added');
		}));

	return router;
};

export const router = authRouter;