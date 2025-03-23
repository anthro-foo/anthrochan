'use strict';

const { Accounts, Boards } = require(__dirname+'/../../db/')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, deleteBoard = require(__dirname+'/../../models/forms/deleteboard.js')
	, cache = require(__dirname+'/../../lib/redis/redis.js');

module.exports = async (req, res) => {

	const { __, __n } = res.locals;
	// console.log('checkedDeleteOwnedBoards', checkedDeleteOwnedBoards);
	const deleteBoards = new Set();

	const amount = await Accounts.deleteMany(req.body.checkedaccounts).then(res => res.deletedCount);
	if (deleteBoards.size > 0) {
		await Promise.all([...deleteBoards].map(async uri => {
			const _board = await Boards.findOne(uri);
			return deleteBoard(uri, _board);
		}));
	}

	//invalidate any of their active sessions
	await cache.del(req.body.checkedaccounts.map(username => `sess:*:${username}`));

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __n('Deleted %s accounts', amount),
		'redirect': '/globalmanage/accounts.html'
	});

};
