'use strict';

const path = require('path')
	, { remove, pathExists } = require('fs-extra')
	, config = require(__dirname+'/../../lib/misc/config.js')
	, uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, moveUpload = require(__dirname+'/../../lib/file/moveupload.js')
	, mimeTypes = require(__dirname+'/../../lib/file/mimetypes.js')
	, deleteTempFiles = require(__dirname+'/../../lib/file/deletetempfiles.js')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, { Assets } = require(__dirname+'/../../db/');

module.exports = async (req, res) => {

	const { __, __n } = res.locals;
	const { checkRealMimeTypes } = config.get;
	const redirect = '/globalmanage/assets.html';

	// check all mime types before we try saving anything
	for (let i = 0; i < res.locals.numFiles; i++) {
		if (!mimeTypes.allowed(req.files.file[i].mimetype, {
			image: true,
			animatedImage: true, //gif flags? i guess lol
			video: false,
			audio: false,
			other: false
		})) {
			await deleteTempFiles(req).catch(console.error);
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Invalid file type for %s. Mimetype %s not allowed.', req.files.file[i].name, req.files.file[i].mimetype),
				'redirect': redirect
			});
		}
	}

	// check for any mismatching supposed mimetypes from the actual file mimetype
	if (checkRealMimeTypes) {
		for (let i = 0; i < res.locals.numFiles; i++) {
			if (!(await mimeTypes.realMimeCheck(req.files.file[i]))) {
				deleteTempFiles(req).catch(console.error);
				return dynamicResponse(req, res, 400, 'message', {
					'title': __('Bad request'),
					'message': __('Mime type mismatch for file "%s"', req.files.file[i].name),
					'redirect': redirect
				});
			}
		}
	}

	const filenames = [];
	for (let i = 0; i < res.locals.numFiles; i++) {
		const file = req.files.file[i];
		file.noExt = path.parse(file.name).name;
		file.filename = file.noExt + file.extension;

		//check if already exists
		const exists = await pathExists(`${uploadDirectory}/flag/${file.filename}`);

		if (exists) {
			await remove(file.tempFilePath);
			continue;
		}

		// add to list after checking it doesnt already exist
		filenames.push(file.filename);

		//then upload it
		await moveUpload(file, file.filename, 'flag/');

		//and delete the temp file
		await remove(file.tempFilePath);

	}

	deleteTempFiles(req).catch(console.error);
	
	// no new flags
	if (filenames.length === 0) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad request'),
			'message': __n('Flag already exist', res.locals.numFiles),
			'redirect': redirect
		});
	}

	// add banners to the db
	await Assets.addFlags(filenames);
	// get new flags and recache
	await Assets.getFlags();

	await remove(`${uploadDirectory}/html/`);

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __('Uploaded %s new flags.', filenames.length),
		'redirect': redirect
	});

};
