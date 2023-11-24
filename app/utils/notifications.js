// Packages
import axios from 'axios';
import _ from 'lodash';

// Models
import NotificationToken from '../models/notificationToken';
import Library from '../models/library';
import ScheduleNotification from '../models/scheduleNotification';

const languages = ['pt', 'en'];
const Headers = {
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `key=${process.env.FCM_KEY}`,
	},
};

export const prepareSendUsersNotifs = async (type, typeId, usersIds, title, message) => {

	if ((type != 'notif' && type != 'library') || !notification) throw errors.invalid_parameter;

	const matchQuery = usersIds && usersIds.length ? { staff: null, user: { $in: usersIds } } : { staff: null };

	console.log(`----- VOU ENVIAR USERS: ------`, usersIds);
	const usersTokens = await NotificationToken.aggregate([
		{ $match: matchQuery },
		{ $group: {
			_id: '$language',
			ios: { $addToSet: { $cond: [{ $eq: ['$device', 'ios'] }, '$token', null] } },
			android: { $addToSet: { $cond: [{ $eq: ['$device', 'android'] }, '$token', null] } },
		} },
		{ $project: { _id: 1, ios: { $setDifference: ['$ios', [null]] }, android: { $setDifference: ['$android', [null]] } } },
	]);

	for (let tokens of usersTokens) {
		const { _id: lang, ios = [], android = [] } = tokens;
		console.log(`----- VOU ENVIAR NOTIFICAÇÕES [${lang}] ------`);
		console.log(`----- ANDROID: [${android.length}] - IOS: [${ios.length}] ------`);
		console.log('TITLE: ', title);
		console.log('MESSAGE: ', message);
		await sendMultiNotifs({ android, ios, title: title[lang], message: message[lang], image: image, data: { notifType: type } });
	}
};

const uniq = (t, i, arr) => arr.indexOf(t) === i;
const deleteMany = async (notRegistered = []) => {
	if (!notRegistered.length) return;
	await NotificationToken.deleteMany({ token: { $in: notRegistered } });
};

const sendMultiNotifs = async ({ android = [], ios = [], title = '', message = '', image = null, data = {} }) => {
	delete data.type;
	const notRegistered = [];
	const androidTokens = android.filter(uniq);

	console.log('IMAGE', image);

	if (androidTokens.length) {
		const body = {
			title,
			body: message,
			data,
			priority: 'high',
			sound: 'enabled',
			notification: {
				title,
				body: message,
			},
		};

		const chunk = 500;
		for (let i = 0, j = androidTokens.length; i < j; i += chunk) {
			const limitTokens = androidTokens.slice(i, i + chunk);
			console.log('LIMIT TOKENS ANDROID: ', limitTokens.length);
			body['registration_ids'] = limitTokens;

			await axios.post('https://fcm.googleapis.com/fcm/send', body, Headers)
				.then(res => {
					const { data } = res;
    
					if (!data.failure) return;
    
					limitTokens.forEach((v, i) => {
						const result = data.results[i];
						if (result && result.error === 'NotRegistered') {
							notRegistered.push(v);
						}
					});
				})
				.catch(err => console.log('failed android', err));
		}
	}

	const iosTokens = ios.filter(uniq);

	if (iosTokens.length) {
		let body = {
			data,
			notification: {
				title,
				body: message,
				data,
				sound: 'enabled',
			},
			// content_available: true,
			show_in_foreground: true,
			priority: 'high',
		};
        
		console.log('BODY IOS', body);

		const chunk = 500;
		for (let i = 0, j = iosTokens.length; i < j; i += chunk) {
			const limitTokens = iosTokens.slice(i, i + chunk);
			console.log('LIMIT TOKENS IOS: ', limitTokens.length);
			body['registration_ids'] = limitTokens;

			await axios.post('https://fcm.googleapis.com/fcm/send', body, Headers)
				.then(res => {
					const { data } = res;
					if (!data.failure) return;

					limitTokens.forEach((v, i) => {
						const result = data.results[i];
						if (result && result.error === 'NotRegistered') {
							notRegistered.push(v);
						}
					});
				})
				.catch(err => console.log('failed ios', err));
		}
	}

	await deleteMany(notRegistered);
};