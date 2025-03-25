'use strict';

const { CustomPages } = require(__dirname+'/../../db/')
	, uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, { remove } = require('fs-extra')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, buildQueue = require(__dirname+'/../../lib/build/queue.js')
	, { prepareMarkdown } = require(__dirname+'/../../lib/post/markdown/markdown.js')
	, messageHandler = require(__dirname+'/../../lib/post/message.js');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	const message = prepareMarkdown(req.body.message, false);
	const { message: markdownPage } = await messageHandler(message, null, null, res.locals.permissions);
	const editedDate = new Date();

	const oldPage = await CustomPages.findOneAndUpdate(
		req.body.page_id,
		req.body.page,
		req.body.title, 
		message,
		markdownPage,
		editedDate).then(res => res.value);

	if (oldPage === null) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad request'),
			'error': __('Custom page does not exist'),
			'redirect': req.headers.referer || '/globalmanage/custompages.html'
		});
	}

	await remove(`${uploadDirectory}/html/custompage/${oldPage.page}.html`);

	const newPage = {
		'_id': oldPage._id,
		'page': req.body.page,
		'title': req.body.title,
		'message': {
			'raw': message,
			'markdown': markdownPage
		},
		'date': oldPage.date,
		'edited': editedDate,
	};

	buildQueue.push({
		'task': 'buildCustomPage',
		'options': {
			'page': newPage.page,
			'customPage': newPage,
		}
	});
	
	const custompages = await CustomPages.find();
	buildQueue.push({
		'task': 'buildCustomPages',
		'options': {
			'custompages': custompages,
		},
	});

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __('Updated custom page'),
		'redirect': '/globalmanage/custompages.html',
	});

};
