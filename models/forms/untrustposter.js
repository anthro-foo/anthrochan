'use strict';

const { Accounts, Boards } = require(__dirname+'/../../db/');

module.exports = async (req, res) => {
	const { __ } = res.locals;
	
	const posts = res.locals.posts;
	const accounts = new Set();
	
	for (let i = 0, len = posts.length; i < len; i++) {
		const post = posts[i];
		if (post.account_username) {
			accounts.add(post.account_username);
		}
	}
	
	if (accounts.size > 0) {
		const accountsArray = [...accounts];
		await Promise.all([
			Accounts.removeTrustedBoard(accountsArray, res.locals.board._id),
			Boards.removeTrusted(res.locals.board._id, accountsArray),
		]);
	}
	
	return {
		message: __('Untrusted users'),
	};
};
