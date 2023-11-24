// Packages
import express from 'express';

// Utils
import { checkToken, checkRole, formDataParser } from './index';
import { response, uploadImage, deleteImage } from '../../utils/misc';
import errors from '../../utils/errors';

// Models
import Country from '../../models/country';

export const getCountries = async req => {
	const { params: { id }, headers: { source } } = req;
    
	let countries;
	if (id) {
		countries = await Country.findOne({ _id: id }).select('_id name states timezones').lean();
	} else {
		const selectFields = source === 'bo' ? '_id name states timezones' : '_id name flag callingCodes translations alpha2Code alpha3Code';
		countries = await Country.find().select(selectFields).lean();
	}

	return { code: 207, countries };
};

//Router
const countriesRouter = errorHandler => {
	const router = express.Router();

	router
		.get('/:id?', errorHandler(async (req, res, next) => {
			const { code, countries } = await getCountries(req,res,next);
			response(req, res, code, 'COUNTRIES_FOUND', 'Found Countries', { countries });
		}));

	return router;
};

export const router = countriesRouter;


