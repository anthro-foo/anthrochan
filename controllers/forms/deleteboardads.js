
'use strict';

const deleteNotFoundImages = require(__dirname + '/../../models/forms/deletenotfoundimages.js')
	, dynamicResponse = require(__dirname + '/../../lib/misc/dynamic.js')
	, paramConverter = require(__dirname + '/../../lib/middleware/input/paramconverter.js')
	, { checkSchema, lengthBody } = require(__dirname + '/../../lib/input/schema.js');

module.exports = {

	paramConverter: paramConverter({
		allowedArrays: ['checkedboardads']
	}),

	controller: async (req, res, next) => {

		const { __ } = res.locals;

		const errors = await checkSchema([
			{ result: lengthBody(req.body.checkednotfoundimages, 1), expected: false, error: __('Must select at least one board ad to delete') },
		]);

		if (errors.length > 0) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'errors': errors,
				'redirect': '/globalmanage/assets.html'
			});
		}

		try {
			await deleteNotFoundImages(req, res, next);
		} catch (err) {
			console.error(err);
			return next(err);
		}

	}

};