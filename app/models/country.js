import { mongoose } from '../utils/database';

const Schema = mongoose.Schema;
const CountrySchema = new Schema({
	name: {	type: String, required: true },
	alpha2Code: { type: String },
	alpha3Code: { type: String },
	capital: { type: String },
	region: { type: String },
	subregion: { type: String },
	population: { type: Number },
	demonym: { type: String },
	area: { type: Number },
	gini: { type: Number },
	nativeName: { type: String },
	numericCode: { type: String },
	flag: { type: String },
	cioc: { type: String },
	translations: {
		en: { type: String },
		de: { type: String },
		es: { type: String },
		fr: { type: String },
		ja: { type: String },
		it: { type: String },
		br: { type: String },
		pt: { type: String },
		nl: { type: String },
		hr: { type: String },
		fa: { type: String },
	},
	currencies: [{
		code: { type: String },
		name: { type: String },
		symbol: { type: String },
		position: { type: String, default: 'right' },
	}],
	languages: [{
		iso639_1: { type: String },
		iso639_2: { type: String },
		name: { type: String },
		nativeName: { type: String },
	}],
	latlng: [],
	borders: [],
	timezones: [],
	callingCodes: [],
	altSpellings: [],
	regionalBlocs: [{
		acronym: { type: String },
		name: { type: String },
		otherAcronyms: [],
		otherNames: [],
	}],
	states: [{
		name: { type: String },
	}],
	topLevelDomain: [],
}, { versionKey: false });

CountrySchema.plugin(require('mongoose-autopopulate'));
const Country = mongoose.model('Country', CountrySchema);
export default Country;
