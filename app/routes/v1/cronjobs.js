// Packages
import express from 'express';
import osu from 'node-os-utils';
import { WebClient } from '@slack/web-api';
import fsExtra from 'fs-extra';
import { exec } from 'child_process';
import { DateTime } from 'luxon';
import cron from 'node-cron';

// Utils
import { response } from '../../utils/misc';
import { prepareSendUsersNotifs } from '../../utils/notifications';

// Models
import Staff from '../../models/staff';
import Meta from '../../models/meta';
import Log from '../../models/log';
import User from '../../models/user';
import ScheduleNotification from '../../models/scheduleNotification';
import Library from '../../models/library';
import Business from '../../models/business';

const getApiStatus = async (req) => {
	await Staff.findOne({}).lean();

	return { code: 207 };
};

const serverStatus = async (req) => {
	const drive = osu.drive;
	const slackToken = process.env.SLACK_TOKEN;
	const conversationId = process.env.SLACK_CHANNEL;
	const slack = new WebClient(slackToken);

	if (process.env.NODE_ENV === 'prod') {
		let info = await drive.info();
    
		if (info.freePercentage < 10) {
			try {
				fsExtra.emptyDir('/home/ubuntu/.pm2/logs');
    
				exec('sudo journalctl --vacuum-size=200M', (error, stdout, stderr) => {
					if (error) {
						console.log(`error: ${error.message}`);
						return;
					}
					if (stderr) {
						console.log(`stderr: ${stderr}`);
						return;
					}
					console.log(`stdout: ${stdout}`);
				});
    
				exec('sudo apt-get autoremove', (error, stdout, stderr) => {
					if (error) {
						console.log(`error: ${error.message}`);
						return;
					}
					if (stderr) {
						console.log(`stderr: ${stderr}`);
						return;
					}
					console.log(`stdout: ${stdout}`);
				});
    
				await slack.chat.postMessage({
					text: `SERVER ALERT - CHECK DISK SPACE BECAUSE IS UNDER 10% BUT THE SERVER WAS ALREADY CLEARED:\n${JSON.stringify(info)}`,
					channel: conversationId,
				});
			} catch (error) {
				console.log('ERROR', error);
			}
		}
	}

	return;
};

const scheduleNotification = async (req) => {
	const currentDate = DateTime.utc().toJSDate();
	const [library, scheduleNotification] = await Promise.all([
		Library.find({ publishSchedule: true, publishScheduleDate: { $lte: currentDate }, published: false }).lean(),
		ScheduleNotification.find({ scheduleDate: { $lte: currentDate }, sent: false }).lean(),
	]);

	// if (library.length) {
	//     for (const lib of library) {
	//         if (lib.notifyUsers && !lib.notificationSent) await prepareSendUsersNotifs('library', lib._id, null, );
	//         await Library.updateOne({ _id: lib._id }, { published: true, publishSchedule: false });
	//     }
	// }

	// if (scheduleNotification.length) {
	//     for (const scheduleNotif of scheduleNotification) {
	//         const users = await User.find({}).distinct('_id');
	//         await prepareSendUsersNotifs('notif', scheduleNotif._id, users, scheduleNotif);
	//         await ScheduleNotification.updateOne({ _id: scheduleNotif._id }, { sent: true });
	//     }
	// }

	return;
};

const moodWarning = async (req) => {
	const todayDate = DateTime.utc().startOf('day').toJSDate();

	const users = await Business.aggregate([
		{ $unwind: '$users' },
		{ $match: { 'users.isActive': true } },
		{ $project: { user: '$users.user' } },
		{ $lookup: {
			from: 'users',
			let: { userId: '$user' },
			pipeline: [
				{ $match: { $expr: { $and: [ 
					{ $eq: ['$$userId', '$_id'] },
					{ $eq: ['$isConfirmed', true] },
					{ $eq: ['$marketingNotification', true] },
				] } } },
				{ $project: { _id: 1 } },
				{ $lookup: {
					from: 'moods',
					let: { userId: '$_id' },
					pipeline: [
						{ $match: { $expr: { $and: [ 
							{ $eq: ['$user', '$$userId'] },
							{ $eq: ['$date', todayDate ] },
						] } } },
						{ $sort: { date: -1 } },
						{ $limit: 1 },
						{ $project: { user: 0, _id: 0 } },
					],
					as: 'mood',
				} },
				{ $match: { mood: { $size: 0 } } },
			],
			as: 'user',
		} },
		{ $unwind: '$user' },
		{ $group: { _id: null, users: { $push: '$user._id' } } },
	]);

	if (users && users[0].users.length) {
		await prepareSendUsersNotifs('mood', null, users[0].users.length);
	}

	return;
};



const manageLogs = async (req) => {

	const date1 = DateTime.local().minus({ days: 7 }).toUTC().toISO();
	const date2 = DateTime.local().minus({ days: 30 }).toUTC().toISO();

	await Promise.all([
		Meta.deleteMany({ _created: { $lte: date1 }, 'res.statusCode': { $lt: 400 } }),
		Log.deleteMany({ _created: { $lte: date1 }, code: { $lt: 400 } }),
		Meta.deleteMany({ _created: { $lte: date2 } }),
		Log.deleteMany({ _created: { $lte: date2 } }),
	]);
    
	return;
};

// cron.schedule('0 9,17 * * *', serverStatus);
// cron.schedule('0 14 * * *', moodWarning);
// cron.schedule('0 2 * * *', manageLogs);
// cron.schedule('* * * * *', scheduleNotification);

//Router
const cronjobsRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/api-status/', errorHandler(async (req, res, next) => {
			const { code } = await getApiStatus(req,res,next);
			response(req,res,code, 'API STATUS_OK', 'API Status ok');
		}));
	return router;
};

export const router = cronjobsRouter;