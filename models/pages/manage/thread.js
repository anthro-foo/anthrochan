'use strict';

const Posts = require(__dirname+'/../../../db/posts.js');

module.exports = async (req, res, next) => {

	const lastReplies = req.url.includes('+50.html');

	let thread;
	try {
		thread = await Posts.getThread(res.locals.board._id, res.locals.thread.postId, true);
		if (!thread) {
			return next(); //deleted between exists
		}
		if (lastReplies && thread.replies.length > 50) {
			thread.replies = thread.replies.slice(-50);
		}
	} catch (err) {
		return next(err);
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('thread', {
			modview: true,
			upLevel: true,
			board: res.locals.board,
			thread,
			lastReplies,
			csrf: req.csrfToken(),
		});

};
