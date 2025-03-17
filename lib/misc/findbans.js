'use strict';

const { Bans } = require(__dirname+'/../../db/')
	, { Permissions } = require(__dirname+'/../permission/permissions.js');

module.exports = async (req, res, next) => {
	//fetch bans
	const banBoard = res.locals.board ? res.locals.board._id : null; //if no board, global bans or "null" board.
	let bans = await Bans.find(res.locals.ip, banBoard);
	//board staff still bypass bans on their board by default
	if (res.locals.permissions.get(Permissions.MANAGE_BOARD_GENERAL)) {
		//filter bans to leave only global bans remaining
		bans = bans.filter(ban => ban.board !== res.locals.board);
	}
	
	return bans;
};