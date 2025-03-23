'use strict';

module.exports = async (req, res) => {

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('globalmanageassets', {
			csrf: req.csrfToken(),
		});

};
