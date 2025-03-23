'use strict';

const { debugLogs } = require(__dirname+'/../../configs/secrets.js')
	, config = require(__dirname+'/../../lib/misc/config.js')
	, Redis = require(__dirname+'/../../lib/redis/redis.js')
	, { Boards, Accounts } = require(__dirname+'/../../db/')
	, timeUtils = require(__dirname+'/../../lib/converter/timeutils.js');

module.exports = {

	func: async () => {

		if (config.get.inactiveAccountAction === 0) {
			return;
		}

		const inactiveAccounts = await Accounts.getInactive(config.get.inactiveAccountTime);
		if (inactiveAccounts.length === 0) {
			return;
		}

		const cacheDeleteSet = new Set()
			, boardBulkWrites = [];

		let boardsPromise = null
			, accountsPromise = null;

		if (boardBulkWrites.length > 0) {
			boardsPromise = Boards.db.bulkWrite(boardBulkWrites);
		}

		//create promise for accounts (clearing staff positions or deleting fuly)
		if (config.get.inactiveAccountAction === 2) {
			debugLogs && console.log(`Deleting ${inactiveAccounts.length} inactive accounts`);
			const inactiveUsernames = inactiveAccounts.map(acc => acc._id);
			if (inactiveUsernames.length > 0) {
				accountsPromise = Accounts.deleteMany(inactiveUsernames);
			}
		} 
		
		//execute promises
		await Promise.all([
			accountsPromise,
			boardsPromise,
		]);
		
		//clear caches
		cacheDeleteSet.forEach(b => Redis.del(`board:${b}`));
		//users: cache already handled by Accounts.deleteMany or Accounts.clearStaffAndOwnedBoards

	},

	interval: timeUtils.DAY,
	immediate: true,
	condition: 'inactiveAccountAction'

};
