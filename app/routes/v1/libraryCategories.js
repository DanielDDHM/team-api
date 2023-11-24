// Packages
import express from 'express';
import _ from 'lodash';

// Utils
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { checkToken } from './index';

// Models
import LibraryCategory from '../../models/libraryCategory';
import Library from '../../models/library';

const getLibraryCategory = async (req) => {
	const { id } = req.params;
	let libraryCategory;

	if (id) {
		libraryCategory = await LibraryCategory.findOne({ _id: id });
		if (!libraryCategory) throw errors.not_found;
	} else {
		libraryCategory = await LibraryCategory.find().lean();
	}

	return { code: 200, libraryCategory };
};

const postLibraryCategory = async (req) => {
	const { body } = req;

	if (!body.name) throw errors.required_fields_empty;

	await LibraryCategory(body).save();

	const libraryCategory = await LibraryCategory.find().lean();

	return { code: 200, libraryCategory };
};

const putLibraryCategory = async (req) => {
	const { params: { id }, body } = req;

	if (!body.name) throw errors.required_fields_empty;

	await LibraryCategory.findOneAndUpdate({ _id: id }, body, { new: true }).lean();

	const libraryCategory = await LibraryCategory.find().lean();

	return { code: 200, libraryCategory };
};

const deleteLibraryCategory = async (req) => {
	const { id } = req.params;

	const existLibrary = await Library.findOne({ category: id }).lean();
	if (existLibrary) throw errors.record_in_use;

	await LibraryCategory.deleteOne({ _id: id });

	const libraryCategory = await LibraryCategory.find().lean();

	return { code: 200, libraryCategory };
};

//Router
const libraryCategoriesRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', errorHandler(async (req, res, next) => {
			const { code, libraryCategory } = await getLibraryCategory(req,res,next);
			response(req, res, code, 'LIBRARY_CATEGORY_FOUND', 'Library Category found', { libraryCategory });
		}))

		.post('/', checkToken(), errorHandler(async (req, res, next) => {
			const { code, libraryCategory } = await postLibraryCategory(req,res,next);
			response(req,res,code, 'LIBRARY_CATEGORY_CREATED', 'Library Category has been created', { libraryCategory });
		}))

		.put('/:id', checkToken(), errorHandler(async (req, res, next) => {
			const { code, libraryCategory } = await putLibraryCategory(req, res, next);
			response(req, res, code, 'LIBRARY_CATEGORY_UPDATED', 'Library Category has been updated', { libraryCategory });
		}))
        
		.delete('/:id', checkToken(), errorHandler(async (req, res, next) => {
			const { code, libraryCategory } = await deleteLibraryCategory(req,res,next);
			response(req,res,code, 'LIBRARY_CATEGORY_DELETED', 'Library Category has been deleted', { libraryCategory });
		}));
	return router;
};

export const router = libraryCategoriesRouter;