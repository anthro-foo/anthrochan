'use strict';

const { Filters } = require(__dirname+'/../../../db/');

module.exports = async (req, res, next) => {

	let filter;
	try {
		filter = await Filters.findOne(req.params.board, req.params.filterid);
	} catch (err) {
		return next(err);
	}

	if (!filter) {
		return next();
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('editfilter', {
			csrf: req.csrfToken(),
			permissions: res.locals.permissions,
			filter,
		});

};
