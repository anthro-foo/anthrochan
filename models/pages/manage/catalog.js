'use strict';

const { Posts, Assets } = require(__dirname + '/../../../db/')
	, path = require('path');

module.exports = async (req, res, next) => {

	let threads;
	try {
		threads = await Posts.getCatalog(req.params.board);
	} catch (err) {
		return next(err);
	}

	res.locals.board.flags = (await Assets.getFlags()).
		map(filename => {
			const name = path.parse(filename).name;
			return { name, filename };
		});

	res
		//.set('Cache-Control', 'private, max-age=1')
		.render('catalog', {
			modview: true,
			threads,
			board: res.locals.board,
			csrf: req.csrfToken(),
		});

};
