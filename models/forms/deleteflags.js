'use strict';

const { remove } = require('fs-extra')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, { Assets } = require(__dirname+'/../../db/');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	const redirect = '/globalmanage/assets.html';

	//delete file of all selected flags
	await Promise.all(req.body.checkedflags.map(async filename => {
		remove(`${uploadDirectory}/flag/${filename}`);
	}));

	//remove from db
	await Assets.removeFlags(req.body.checkedflags);
	// get new flags and recache
	await Assets.getFlags();

	await remove(`${uploadDirectory}/html/`);

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __('Deleted %s banners', req.body.checkedflags.length),
		'redirect': redirect
	});
};
