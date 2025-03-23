'use strict';

const { Boards, Modlogs } = require(__dirname+'/../../db/')
	, ModlogActions = require(__dirname+'/../../lib/input/modlogactions.js')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, restrictedURIs = new Set(['captcha', 'forms', 'randombanner', 'all'])
	, { ensureDir } = require('fs-extra')
	, config = require(__dirname+'/../../lib/misc/config.js');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	const { boardDefaults } = config.get;

	const { name, description } = req.body
		, uri = req.body.uri.toLowerCase()
		, tags = (req.body.tags || '').split(/\r?\n/).filter(n => n);

	if (restrictedURIs.has(uri)) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad Request'),
			'message': __('URI "%s" is reserved', uri),
			'redirect': '/create.html'
		});
	}

	const board = await Boards.findOne(uri);

	// if board exists reject
	if (board != null) {
		return dynamicResponse(req, res, 409, 'message', {
			'title': __('Conflict'),
			'message': __('Board with this URI already exists'),
			'redirect': '/create.html'
		});
	}

	const newBoard = {
		'_id': uri,
		tags,
		'banners': [],
		'sequence_value': 1,
		'pph': 0,
		'ppd': 0,
		'ips': 0,
		'lastPostTimestamp': null,
		'webring': false,
		'flags': {},
		'assets': [],
		'settings': {
			name,
			description,
			...boardDefaults
		}
	};

	await Promise.all([
		Modlogs.insertOne({
			board: null,
			showLinks: true,
			postLinks: [{ board: uri }],
			actions: [ModlogActions.CREATE_BOARD],
			public: false,
			date: new Date(),
			showUser: true,
			message: __('Created board /%s/', uri),
			user: req.session.user,
			ip: {
				cloak: res.locals.ip.cloak,
				raw: res.locals.ip.raw,
			}
		}),
		Boards.insertOne(newBoard),
		ensureDir(`${uploadDirectory}/html/${uri}`),
		ensureDir(`${uploadDirectory}/json/${uri}`),
		ensureDir(`${uploadDirectory}/banner/${uri}`),
		ensureDir(`${uploadDirectory}/flag/${uri}`),
		ensureDir(`${uploadDirectory}/asset/${uri}`),
	]);

	return res.redirect(`/${req.body.uri}/index.html`);

};
