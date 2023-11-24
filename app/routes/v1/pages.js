// Packages
import express from 'express';
import _ from 'lodash';

// Utils
import { checkToken, checkRole } from './index';
import { response } from '../../utils/misc';
import errors from '../../utils/errors';

// Models
import Page from '../../models/page';

const getPages = async (req) => {
	const { params: { id } } = req;

	let pages = [];
	if (id) {
		if (id.match(/^[0-9a-fA-F]{24}$/)) {
			pages = await Page.findOne({ _id: id });
		} else {
			pages = await Page.findOne({ type: id });
		}
		if (!pages) throw errors.not_found;
	} else {
		pages = await Page.find();
	}

	return { code: 200, pages };
};

const putPage = async (req) => {
	const { params: { id }, body } = req;

	const page  = await Page.findOneAndUpdate({ _id: id }, body, { new: true });

	return { code: 200, page };
};

const patchPage = async (req) => {
	const { params: { id }, body } = req;

	if(body.isActive == null) throw errors.required_fields_empty;
    
	await Page.updateOne({ _id: id}, { isActive: body.isActive });

	const pages = await Page.find().lean();

	return { code: 200, pages };
};

const pagesRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', errorHandler(async (req, res, next) => {
			const { code, pages } = await getPages(req,res,next);
			response(req, res, code, 'PAGES_FOUND', 'Found Pages', { pages });
		}))

		.put('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, page } = await putPage(req, res, next);
			response(req, res, code, 'PAGE_UPDATED', 'Page has been updated', { page });
		}))

		.patch('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, pages } = await patchPage(req, res, next);
			response(req, res, code, 'PAGE_ACTIVE_UPDATED', 'Page has been updated', { pages });
		}));
	return router;
};

export const router = pagesRouter;