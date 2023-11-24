import AWS from 'aws-sdk';
import _ from 'lodash';

export const uploadMultipleImages = async (req, pluralModel) => {
	const { body } = req;
	const links = [];
	for (const file of body.files) {
		if (file && file.fileName) {
			const fileExt = file.contentType.split('/')[1].toLowerCase();
			const timestamp = new Date().getTime();
			const location = `${process.env.NODE_ENV}/images/${pluralModel}/${timestamp}.${fileExt}`;
			const fileLink = await uploadS3(location, file.file, file.contentType);
			if (!fileLink) throw errors.internal_error;
			links.push(fileLink.Location);
		}
	}

	return { code: 200, fileLink: links.length === 1 ? links[0] : links  };
};

export const uploadImage  = async (file, pluralModel) => {
	const fileExt = file.contentType.split('/')[1].toLowerCase();
	const timestamp = new Date().getTime();
	const location = `${process.env.NODE_ENV}/images/${pluralModel}/${timestamp}.${fileExt}`;
	const fileLink = await uploadS3(location, file.file, file.contentType);
	if (!fileLink) throw errors.internal_error;
	return fileLink.Location;
};

export const deleteImage = async (img, pluralModel) => {
	let fileName = img.split('/');
	fileName = fileName[fileName.length - 1];
	const location = `${process.env.NODE_ENV}/images/${pluralModel}/${fileName}`;
	await deleteS3(location);
};

export const uploadS3 = async (filename, file, contentType) => {
	try {
		AWS.config.update({
			accessKeyId: `${process.env.AWS_ACCESS_KEY_ID}`,
			secretAccessKey: `${process.env.AWS_SECRET_ACCESS_KEY}`,
			region: 'eu-central-1',
		});

		const s3 = new AWS.S3();

		const s3Params = {
			Bucket: 'team-dev',
			Key: filename,
			Body: file,
			ACL: 'public-read',
			ContentType: contentType,
		};

		const upload = await s3.upload(s3Params).promise();

		return upload;
	} catch (err) {
		console.log(err);
	}

};

const deleteS3 = async (filename) => {
	return new Promise((resolve, reject) => {
		try {
			AWS.config.update({
				accessKeyId: `${process.env.AWS_ACCESS_KEY_ID}`,
				secretAccessKey: `${process.env.AWS_SECRET_ACCESS_KEY}`,
				region: 'eu-central-1',
			});

			const s3 = new AWS.S3();

			const s3Params = {
				Bucket: 'team-dev',
				Key: filename,
			};

			s3.deleteObject(s3Params, (err, data) => {
				if (err) reject();
				resolve(data);
			});
		} catch (err) {
			console.log(err);
		}
	});
};
