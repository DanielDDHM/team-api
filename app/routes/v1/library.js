// Packages
import express from 'express';
import _ from 'lodash';
import { mongoose } from '../../utils/database';

// Utils
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { prepareSendUsersNotifs } from '../../utils/notifications';
import { checkToken, checkRole, formDataParser } from './index';
import { uploadImage, deleteImage } from '../../utils/upload';

// Models
import Library from '../../models/library';
import Notification from '../../models/notification';

const getLibrary = async (req) => {
	const { params: { id } } = req;
	let library;
    
	if (id) {
		library = await Library.findOne({ _id: id }).populate('businesses').lean();
		if (!library) throw errors.not_found;
	} else library = await Library.find().lean();

	return { code: 200, library };
};

const postLibrary = async (req) => {
	const { body } = req;

	if (body.published && !body.name && !body.description && !body.category) throw errors.required_fields_empty;
	if (body.publishSchedule && !body.name && !body.description && body.publishScheduleDate) throw errors.required_fields_empty;

	if (body.files && body.files.length) {
		for (const file of body.files) {
			const fieldName = file.fieldName.split('_');
			if (fieldName[0] == 'image') body.image = await uploadImage(file, 'library');
			if (fieldName[0] == 'audio') body.audio = await uploadImage(file, 'library');
			if (fieldName[0] == 'music') body.music = await uploadImage(file, 'library');
			if (fieldName[0] == 'video') body.video = await uploadImage(file, 'library');
			if (fieldName[0] == 'file') {
				const lang = fieldName[2];
				const newAttachedFile = body.attachedFiles.find(attachedFile => attachedFile.value === fieldName[1]);
				if (lang && newAttachedFile) {
					const link = await uploadImage(file, 'library');
					if (!newAttachedFile.url) newAttachedFile.url = {};
					newAttachedFile.url[lang] = link;
				}
			}
		}
	}

	if (body.published && body.publishSchedule) body.publishSchedule = false;

	const newLibrary = await Library(body).save();

	// if (newLibrary.published && newLibrary.notifyUsers && !newLibrary.notificationSent) await prepareSendUsersNotifs('library', newLibrary._id)

	const library = await Library.findOne({ _id: newLibrary._id }).populate('businesses');

	return { code: 200, library };
};

const putLibrary = async (req) => {
	const { params: { id }, body } = req;

	if (body.published && !body.name && !body.description && !body.category) throw errors.required_fields_empty;
	if (body.publishSchedule && !body.name && !body.description && body.publishScheduleDate) throw errors.required_fields_empty;
    
	if (body.files && body.files.length) {
		for (const file of body.files) {
			const fieldName = file.fieldName.split('_');
			if (fieldName[0] == 'image') body.image = await uploadImage(file, 'library');
			if (fieldName[0] == 'audio') body.audio = await uploadImage(file, 'library');
			if (fieldName[0] == 'music') body.music = await uploadImage(file, 'library');
			if (fieldName[0] == 'video') body.video = await uploadImage(file, 'library');
			if (fieldName[0] == 'file') {
				const lang = fieldName[2];
				const newAttachedFile = body.attachedFiles.find(attachedFile => attachedFile.value === fieldName[1]);
				if (lang && newAttachedFile) {
					const link = await uploadImage(file, 'library');
					if (!newAttachedFile.url) newAttachedFile.url = {};
					newAttachedFile.url[lang] = link;
				}
			}
		}
	}

	if (body.filesToDelete && body.filesToDelete.length) {
		for (const file of body.filesToDelete) {
			await deleteImage(file, 'library');
		}
	}

	if (body.businesses && body.businesses.length) {
		console.log('BUSINESSES', body.businesses);
		const newBusinesses = body.businesses.map(business => business._id);
		console.log('NEW BUSINESSES', newBusinesses);
		delete body.businesses;
		body.businesses = newBusinesses;
	}

	if (body.published && body.publishSchedule) body.publishSchedule = false;

	const library = await Library.findOneAndUpdate({ _id: id }, body, { new: true }).populate('businesses');

	// if (library.published && library.notifyUsers && !library.notificationSent) await prepareSendUsersNotifs('library', library._id)

	return { code: 200, library };
};

const deleteLibrary = async (req) => {
	const { id } = req.params;

	await Promise.all([
		Library.deleteOne({ _id: id }),
		Notification.deleteMany({ library: id }),
	]);

	const library = await Library.find().lean();

	return { code: 200, library };
};

//Router
const libraryRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const {library, code } = await getLibrary(req,res,next);
			response(req, res, code, 'LIBRARY_FOUND', 'Library found', { library });
		}))

		.post('/', checkToken(), checkRole('sysadmin', 'owner', 'admin'), formDataParser(), errorHandler(async (req, res, next) => {
			const {library, code } = await postLibrary(req,res,next);
			response(req,res,code, 'LIBRARY_CREATED', 'Library has been created', { library });
		}))

		.put('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), formDataParser(), errorHandler(async (req, res, next) => {
			const { code, library } = await putLibrary(req, res, next);
			response(req, res, code, 'LIBRARY_UPDATED', 'Library has been updated', { library });
		}))

		.delete('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, library } = await deleteLibrary(req,res,next);
			response(req,res,code, 'LIBRARY_DELETED', 'Library has been deleted', { library });
		}));
	return router;
};

export const router = libraryRouter;