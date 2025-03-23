'use strict';

const { Bans } = require(__dirname+'/../../db/');

module.exports = async (req, res) => {
	//fetch bans
	const banBoard = res.locals.board ? res.locals.board._id : null; //if no board, global bans or "null" board.
	let bans = await Bans.find(res.locals.ip, banBoard);
	
	return bans;
};