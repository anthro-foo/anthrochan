'use strict';

const { Posts, Assets } = require(__dirname + '/../../../db/')
	, path = require('path');

module.exports = async (req, res, next) => {

	const page = req.params.page === 'index' ? 1 : Number(req.params.page);
	let maxPage;
	let threads;
	try {
		maxPage = Math.min(Math.ceil((await Posts.getPages(req.params.board)) / 10), Math.ceil(res.locals.board.settings.threadLimit / 10)) || 1;
		if (page > maxPage) {
			return next();
		}
		threads = await Posts.getRecent(req.params.board, page, 10, true);
	} catch (err) {
		return next(err);
	}

	res.locals.board.flags = (await Assets.getFlags()).
		map(filename => {
			const name = path.parse(filename).name;
			return { name, filename };
		});

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('board', {
			modview: true,
			page,
			maxPage,
			threads,
			board: res.locals.board,
			csrf: req.csrfToken(),
		});

};
