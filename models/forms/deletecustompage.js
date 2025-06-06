'use strict';

const uploadDirectory = require(__dirname + '/../../lib/file/uploaddirectory.js')
	, { remove } = require('fs-extra')
	, { CustomPages } = require(__dirname + '/../../db/')
	, buildQueue = require(__dirname + '/../../lib/build/queue.js')
	, dynamicResponse = require(__dirname + '/../../lib/misc/dynamic.js');

module.exports = async (req, res) => {

	const { __, __n } = res.locals;
	const deletedCount = await CustomPages.deleteMany(req.body.checkedcustompages).then(res => res.deletedCount);

	if (deletedCount === 0) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': 'Bad Request',
			'message': 'Invalid custom pages selected',
			'redirect': '/globalmanage/custompages.html'
		});
	}

	await Promise.all(req.body.checkedcustompages.map(page => {
		return Promise.all([
			remove(`${uploadDirectory}/html/custompage/${page}.html`),
			remove(`${uploadDirectory}/json/custompage/${page}.json`),
		]);
	}));

	const custompages = await CustomPages.find();
	buildQueue.push({
		'task': 'buildCustomPages',
		'options': {
			'custompages': custompages,
		},
	});

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __n('Deleted %s custom pages', deletedCount),
		'redirect': '/globalmanage/custompages.html'
	});

};
