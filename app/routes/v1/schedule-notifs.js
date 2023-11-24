// Packages
import express from 'express';
import _ from 'lodash';

// Utils
import { checkToken, checkRole, formDataParser } from './index';
import { response } from '../../utils/misc';
import errors from '../../utils/errors';

// Models
import ScheduleNotification from '../../models/scheduleNotification';

const getScheduleNotification = async (req) => {
	const { id } = req.params;
	let scheduleNotification;

	if (id) {
		scheduleNotification = await ScheduleNotification.findOne({ _id: id }).populate('businesses').lean();
		if (!scheduleNotification) throw errors.not_found;
	} else {
		scheduleNotification = await ScheduleNotification.find().lean();
	}

	return { code: 200, scheduleNotification };
};

const postScheduleNotification = async (req) => {
	const { body } = req;

	if (!body.title || !body.description) throw errors.required_fields_empty;

	const newScheduleNotification = await ScheduleNotification(body).save();
	const scheduleNotification = await ScheduleNotification.findOne({ _id: newScheduleNotification._id }).populate('businesses').lean();

	return { code: 200, scheduleNotification };
};

const putScheduleNotification = async (req) => {
	const { params: { id }, body } = req;

	if (!body.title || !body.description) throw errors.required_fields_empty;

	const scheduleNotification = await ScheduleNotification.findOneAndUpdate({ _id: id }, body, { new: true }).populate('businesses').lean();

	return { code: 200, scheduleNotification };
};

const deleteScheduleNotification = async (req) => {
	const { id } = req.params;

	await ScheduleNotification.deleteOne({ _id: id });
	const scheduleNotification = await ScheduleNotification.find().lean();

	return { code: 200, scheduleNotification };
};

//Router
const scheduleNotificationsRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, scheduleNotification } = await getScheduleNotification(req,res,next);
			response(req, res, code, 'NOTIFICATION_FOUND', 'Schedule Notification found', { scheduleNotification });
		}))

		.post('/', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, scheduleNotification } = await postScheduleNotification(req,res,next);
			response(req,res,code, 'NOTIFICATION_CREATED', 'Schedule Notification has been created', { scheduleNotification });
		}))

		.put('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, scheduleNotification } = await putScheduleNotification(req, res, next);
			response(req, res, code, 'NOTIFICATION_UPDATED', 'Schedule Notification has been updated', { scheduleNotification });
		}))

		.delete('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, scheduleNotification } = await deleteScheduleNotification(req,res,next);
			response(req,res,code, 'NOTIFICATION_DELETED', 'Schedule Notification has been deleted', { scheduleNotification });
		}));
	return router;
};

export const router = scheduleNotificationsRouter;