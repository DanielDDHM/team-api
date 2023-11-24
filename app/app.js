// Packages
const logger = require('morgan');
import express from 'express';
import cookieParser from 'cookie-parser';
import https from 'https';
import io from './utils/socket';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Utils
import errors from './utils/errors';
import dbConnection, { mongoose } from './utils/database';
import { error, response } from './utils/misc';
import index from './routes/v1/index';

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let options = {};
if (process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'dev') {
	const sslPath = '/etc/ssl/resty-auto-ssl-fallback';
	options = {
		key: fs.readFileSync(`${sslPath}.key`),
		cert: fs.readFileSync(`${sslPath}.crt`),
	};
} else {
	options = {
		key: fs.readFileSync(path.join(__dirname, '../security/cert.key')),
		cert: fs.readFileSync(path.join(__dirname, '../security/cert.pem')),
	};
}

const httpsServer = https.createServer(options, app);

// Enable All CORS Requests
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const showLogs = process.env.LOGS === 'false' === false;
if(!showLogs){
	console.log = function() {};
}

// Connect to the DB
dbConnection().then(() => console.log('DB connected...'));

//Register Route V1
app.use(process.env.API_URL || '/api', index(app, httpsServer));

//404 handler
app.use(function (req, res, next) {
	next(error(errors.not_found));
});

//error handler
app.use(function (err, req, res, next) {
	const availableLang = ['pt', 'en', 'es'];
	const lang = availableLang.find(existLang => existLang === req.headers['accept-language']) || 'en';
	const message = JSON.parse(err.message);
	console.error('[ERROR]', err);
	response(req, res, err.status, err.code, message[lang] ? message[lang] : message['en'] ? message['en'] : err.message);
});

//https server
const port = process.env.API_PORT || 3012;
httpsServer.listen(port, () => console.log(`Connected on port: ${port}`));
io.setConnection(httpsServer);

process.on('SIGINT', () => {
	httpsServer.close(function (err) {
		// if error, log and exit with error (1 code)
		if (err) {
			console.error('Err on shutdown', err);
			process.exit(1);
		}
		try {
			mongoose.disconnect();
		} catch (err) {
			console.error('error on close', err);
		}

	});
});

module.exports = app;
