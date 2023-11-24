// Packages
import express from 'express';
import _ from 'lodash';
import { mongoose } from '../../utils/database';

// Utils
import errors from '../../utils/errors';
import { response } from '../../utils/misc';
import { checkToken, checkRole, formDataParser } from './index';

// Models
import Diagnosis from '../../models/diagnosis';

const getDiagnosis = async (req) => {
	const { params: { id } } = req;
	let diagnosis;
    
	if (id) {
		diagnosis = await Diagnosis.findOne({ _id: id }).lean();
		if (!diagnosis) throw errors.not_found;
	} else diagnosis = await Diagnosis.find().lean();

	return { code: 200, diagnosis };
};

const postDiagnosis = async (req) => {
	const { body } = req;

	if (!body.name) throw errors.missing_fields;

	const diagnosis = await Diagnosis(body).save();

	return { code: 200, diagnosis };
};

const putDiagnosis = async (req) => {
	const { params: { id }, body } = req;

	if (!body.name) throw errors.missing_fields;

	await Diagnosis.updateOne({ _id: id }, body);
	const diagnosis = await Diagnosis.find();

	return { code: 200, diagnosis };
};

const patchDiagnosis = async (req) => {
	const { params: { id }, body } = req;

	if (body.isActive == null) throw errors.required_fields_empty;
    
	await Diagnosis.findOneAndUpdate({ _id: id }, { isActive: body.isActive });
    
	const diagnosis = await Diagnosis.find();

	return { code: 200, diagnosis };
};

const deleteDiagnosis = async (req) => {
	const { params: { id } } = req;

	// const [] = await Promise.all([
        
	// ])
	// if () throw errors.file_in_use;

	const diagnosis = await Diagnosis.find().lean();

	return { code: 200, diagnosis };
};

//Router
const diagnosisRouter = errorHandler => {
	const router = express.Router();
	router
		.get('/:id?', checkToken(), checkRole('sysadmin', 'owner', 'admin', 'psychologist'), errorHandler(async (req, res, next) => {
			const {diagnosis, code } = await getDiagnosis(req,res,next);
			response(req, res, code, 'DIAGNOSIS_FOUND', 'Diagnosis found', { diagnosis });
		}))

		.post('/', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const {diagnosis, code } = await postDiagnosis(req,res,next);
			response(req,res,code, 'DIAGNOSIS_CREATED', 'Diagnosis has been created', { diagnosis });
		}))

		.put('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, diagnosis } = await putDiagnosis(req, res, next);
			response(req, res, code, 'DIAGNOSIS_UPDATED', 'Diagnosis has been updated', { diagnosis });
		}))

		.patch('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, diagnosis } = await patchDiagnosis(req, res, next);
			response(req, res, code, 'DIAGNOSIS_STATUS_UPDATED', 'Diagnosis status has been updated', { diagnosis });
		}))

		.delete('/:id', checkToken(), checkRole('sysadmin', 'owner', 'admin'), errorHandler(async (req, res, next) => {
			const { code, diagnosis } = await deleteDiagnosis(req,res,next);
			response(req,res,code, 'DIAGNOSIS_DELETED', 'Diagnosis has been deleted', { diagnosis });
		}));
	return router;
};

export const router = diagnosisRouter;