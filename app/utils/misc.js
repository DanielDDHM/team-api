import { DateTime } from 'luxon';
import axios from 'axios';
import bcrypt from 'bcrypt';
import _ from 'lodash';
import { WebClient } from '@slack/web-api';


import Meta from '../models/meta';
import Log from '../models/log';
import Statistic from '../models/statistic';
import User from '../models/user';

const BLACK_LIST = [207];

export const response = async (req, res, status = 500, code = null, message = null, data = null, log = process.env.LOGS_RECORD === 'true') => {
	const { user, headers: { source } } = req;
	
	if (!BLACK_LIST.includes(status) && log && req._startTime) {
		const responseTime = DateTime.local().diff(DateTime.fromJSDate(req._startTime), 'milliseconds').valueOf();

		if ('password' in req.body) {
			req.body.password = bcrypt.hashSync(req.body.password, 10);
		}
		if ('currentPassword' in req.body) {
			req.body.currentPassword = bcrypt.hashSync(req.body.currentPassword, 10);
		}

		const newMeta = await new Meta({
			response: message,
			date: new Date(req._startTime),
			res: {
				results: data,
				statusCode: status,
			},
			req: {
				url: req.url,
				headers: req.headers,
				method: req.method,
				httpVersion: req.httpVersion,
				originalUrl: req.originalUrl,
				query: req.query,
				body: req.body,
			},
			responseTime: responseTime,
		}).save();

		await new Log({
			level: log ? 'info' : 'error',
			message: `[${DateTime.utc().toFormat('f')}] ${status} ${req.method} ${responseTime}ms ${req.url}`,
			response: message,
			description: req.originalUrl,
			userId: req.user && req.user._id,
			date: DateTime.fromISO(req._startTime).toUTC().toISO(),
			token: req.headers && req.headers.authorization && req.headers.authorization.split(' ')[1],
			method: req.method,
			code: status,
			source: req.headers && req.headers.source,
			meta: newMeta._id,
		}).save();
	}

	if (source != 'bo' && user && user.role === 'user' && user.businessId) {
		const dateNow = DateTime.utc().startOf('day');
		if (user.lastUsage && user.lastUsage.length) {
			const existLastUsage = user.lastUsage.find(element => element.os === req.headers.os && element.type === source);
			if (!existLastUsage) {
				const lastUsage = {
					type: source,
					os: req.headers.os,
					date: dateNow,
				};
				
				const newEntry = {
					date: dateNow,
					user: user._id,
					business: user.businessId,
					type: source,
					os: req.headers.os,
					deviceId: req.headers.deviceId,
					platform: req.headers.model,
				};
				
				try {
					await Promise.all([
						new Statistic(newEntry).save(),
						User.updateOne({ _id: user._id }, { $push: { lastUsage: lastUsage } }),
					]);
				} catch (error) {
					console.log('ERROR ENTERING STATS: ', error);
				}
			} else {
				const difTime = Math.round(dateNow.diff(DateTime.fromJSDate(existLastUsage.date), 'days').days);
				if (difTime > 0) {
					const lastUsage = {
						type: source,
						os: req.headers.os,
						date: dateNow,
					};
					
					const newEntry = {
						date: dateNow,
						user: user._id,
						business: user.businessId,
						type: source,
						os: req.headers.os,
						deviceId: req.headers.deviceId,
						platform: req.headers.model,
					};
					try {
						await Promise.all([
							new Statistic(newEntry).save(),
							User.updateOne({ _id: user._id, 'lastUsage._id': existLastUsage._id }, { $set: { 'lastUsage.$': lastUsage }}),
						]);
					} catch (error) {
						console.log('ERROR ENTERING STATS: ', error);
					}
				}
			}
		} else {
			const lastUsage = [{
				type: source,
				os: req.headers.os,
				date: dateNow,
			}];
			
			const newEntry = {
				date: dateNow,
				user: user._id,
				business: user.businessId,
				type: source,
				os: req.headers.os,
				deviceId: req.headers.deviceId,
				platform: req.headers.model,
			};

			try {
				await Promise.all([
					new Statistic(newEntry).save(),
					User.updateOne({ _id: user._id }, { $set: { lastUsage: lastUsage } }),
				]);
			} catch (error) {
				console.log('ERROR ENTERING STATS: ', error);
			}
		}
	}

	if (status == 500 || status == 402) {
		try {
			const slackToken = process.env.SLACK_TOKEN;
			const conversationId = process.env.SLACK_CHANNEL;

			const slack = new WebClient(slackToken);
			
			await slack.chat.postMessage({
				text: `An API error happens in the enviroment: (${req.method} - ${process.env.NODE_ENV})\nEndpoint: ${req.url}\nMessage: ${message}`,
				channel: conversationId,
			});
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	const lang = res.req.headers['accept-language'];
	let msg = JSON.parse(JSON.stringify(message));
	if (msg[lang]) msg = msg[lang];

	res.status(status).json({
		code: code,
		message: msg,
		results: data,
	});
};

export const error = (err) => {
	const error = new Error(JSON.stringify(err.message));
	error.status = err.status;
	error.code = err.code;
	return error;
};

export const validateLanguageModel = obj => {
	if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) {
		for (const key in obj) {
			if (typeof obj[key] === 'string' && obj[key].length > 0) {
				return true;
			}
		}
		return false;
	}
	return false;

};

export const validateNIF = (nif) => {
	nif = nif.substring(2, nif.length);

	if (nif.length == 9){
		const added = ((nif[7]*2)+(nif[6]*3)+(nif[5]*4)+(nif[4]*5)+(nif[3]*6)+(nif[2]*7)+(nif[1]*8)+(nif[0]*9));
		const mod = added % 11;
		let control;
		if (mod == 0 || mod == 1){
			control = 0;
		} else {
			control = 11 - mod;
		}

		if (nif[8] == control){
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
};

export const roundTo = function (n, digits) {
	if (digits === undefined) {
		digits = 0;
	}
	const multiplicator = Math.pow(10, digits);
	n = parseFloat((n * multiplicator).toFixed(11));
	const test = (Math.round(n) / multiplicator);
	return +(test.toFixed(digits));
};

export const translateString = async (objToTranslate) => {
	const deeplKey = process.env.DEEPL_KEY;
	if (!deeplKey) return objToTranslate;

	let textToTranslate;
	let textTranslated;
	let originLang;
	let objTranslated = objToTranslate;
	
	if (objToTranslate.en && objToTranslate.en != '') {
		textToTranslate = objToTranslate.en;
		originLang = 'EN';
	} else if (objToTranslate.es && objToTranslate.es != '') {
		textToTranslate = objToTranslate.es;
		originLang = 'ES';
	} else if (objToTranslate.pt && objToTranslate.pt != '') {
		textToTranslate = objToTranslate.pt;
		originLang = 'PT';
	} else if (objToTranslate.fr && objToTranslate.fr != '') {
		textToTranslate = objToTranslate.fr;
		originLang = 'FR';
	} else return objTranslated;

	let parameters = {
		auth_key: deeplKey,
		text: textToTranslate,
		source_lang: originLang,
	};

	try {
		if (!objToTranslate.en || objToTranslate.en == '') {
			parameters.target_lang = 'EN';
			textTranslated = await axios.post(`https://api-free.deepl.com/v2/translate`, new URLSearchParams(parameters));
			textTranslated = textTranslated.data.translations[0];
			if (textTranslated && textTranslated.detected_source_language == originLang) objTranslated.en = textTranslated.text;
		}
	
		if (!objToTranslate.es || objToTranslate.es == '') {
			parameters.target_lang = 'ES';
			textTranslated = await axios.post(`https://api-free.deepl.com/v2/translate`, new URLSearchParams(parameters));
			textTranslated = textTranslated.data.translations[0];
			if (textTranslated && textTranslated.detected_source_language == originLang) objTranslated.es = textTranslated.text;
		}
	
		if (!objToTranslate.pt || objToTranslate.pt == '') {
			parameters.target_lang = 'PT';
			textTranslated = await axios.post(`https://api-free.deepl.com/v2/translate`, new URLSearchParams(parameters));
			textTranslated = textTranslated.data.translations[0];
			if (textTranslated && textTranslated.detected_source_language == originLang) objTranslated.pt = textTranslated.text;
		}
	
		if (!objToTranslate.fr || objToTranslate.fr == '') {
			parameters.target_lang = 'FR';
			textTranslated = await axios.post(`https://api-free.deepl.com/v2/translate`, new URLSearchParams(parameters));
			textTranslated = textTranslated.data.translations[0];
			if (textTranslated && textTranslated.detected_source_language == originLang) objTranslated.fr = textTranslated.text;
		}
	} catch (error) {
		console.log('ERROR', error);
	}

	
	return objTranslated;
};
