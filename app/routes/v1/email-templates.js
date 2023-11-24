// Packages
import express from 'express';
import _ from 'lodash';

// Utils
import { checkToken, checkRole, formDataParser } from './index';
import { response } from '../../utils/misc';
import errors from '../../utils/errors';

// Models
import EmailTemplate from '../../models/emailTemplate';

const getEmailTemplate = async (req) => {
	const { id } = req.params;
	let emailTemplate = [];

	if (id) {
		emailTemplate = await EmailTemplate.findOne({ _id: id });
		if (!emailTemplate) throw errors.not_found;
	} else {
		emailTemplate = await EmailTemplate.aggregate([{ $project: { key: 1 } }]);
	}

	return { code: 200, emailTemplate };
};

const putEmailTemplate = async (req) => {
	const { params: { id }, body } = req;
	console.log('BODY', body);

	if (!body.key || !body.subject) throw errors.required_fields_empty;

	await EmailTemplate.updateOne({ _id: id }, body, { new: true });
	const emailTemplate = await EmailTemplate.find();

	return { code: 200, emailTemplate };
};

//Router
const emailTemplatesRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, emailTemplate } = await getEmailTemplate(req,res,next);
			response(req, res, code, 'EMAIL_TEMPLATE_FOUND', 'Email Template found', { emailTemplate });
		}))
		.put('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, emailTemplate } = await putEmailTemplate(req, res, next);
			response(req, res, code, 'EMAIL_TEMPLATE_UPDATED', 'Email Template has been updated', { emailTemplate });
		}));
	return router;
};

export const router = emailTemplatesRouter;