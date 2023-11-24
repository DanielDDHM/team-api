import AWS from 'aws-sdk';
import _ from 'lodash';

import Email from '../models/emailTemplate';
import config from './config';

const awsKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

export const sendEmail = async (templateName, subjectObj, mapObj, to, lang = 'pt', bcc = false) => {
	return new Promise(async resolve => {
		AWS.config.update({
			awsKeyId,
			awsAccessKey,
			region: 'eu-west-1',
		});

		const emailTemplate = await Email.findOne({ key: templateName }).lean();
		if (emailTemplate && emailTemplate.to) {
			to = emailTemplate.to.split(';');
		}
		if (emailTemplate.subject && !subjectObj) {
			subjectObj = emailTemplate.subject[lang];
		}

		const params = {
			Destination: {
				ToAddresses: Array.isArray(to) ? to : [to],
			},
			Message: {
				Body: {
					Html: {
						Charset: 'UTF-8',
						Data: emailTranslator(await templatePicker(templateName, lang || 'pt'), mapObj),
					},
				},
				Subject: {
					Charset: 'UTF-8',
					Data: subjectObj || 'Template',
				},
			},
			Source: `${config.emailTags.app_name} <projects@gmail.com>`,
		};

		const sendPromise = new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();

		sendPromise.then(() => {
			resolve();
		}).catch((err) => {
			console.log('errrr', err);
			Promise.reject(err);
		});
	});
};

const emailTranslator = (template, mapObj) => {
	for (const key in mapObj) {
		template = template.replace(new RegExp(`<%${key}%>`, 'g'), mapObj[key]);
	}
	return template;
};

const templatePicker = async (key, lang) => {
	let validTemplate = null;
	const t = await Email.find({});
	const emailTemplate = await Email.findOne({ key }).lean();

	validTemplate = emailTemplate.values[lang];

	return validTemplate;
};