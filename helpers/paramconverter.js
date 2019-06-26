'use strict';

const Mongo = require(__dirname+'/../db/db.js')
	, allowedArrays = new Set(['checkedposts', 'globalcheckedposts', 'checkedbans', 'checkedbanners']) //only these can be arrays, since express bodyparser will output arrays
	, trimFields = ['message', 'name', 'subject', 'email', 'password', 'default_name', 'report_reason', 'ban_reason'] //trim if we dont want filed with whitespace
	, numberFields = ['reply_limit', 'max_files', 'thread_limit', 'thread', 'min_message_length'] //convert these to numbers before they hit our routes
	, banDurationRegex = /^(?<years>[\d]+y)?(?<months>[\d]+m)?(?<weeks>[\d]+w)?(?<days>[\d]+d)?(?<hours>[\d]+h)?$/
	, banDurations = { //times in millisecond, to be added to date for ban duration
		'years': 31536000000,
		'months': 2592000000,
		'weeks': 604800000,
		'days': 86400000,
		'hours': 3600000
	};

module.exports = (req, res, next) => {

	const bodyfields = Object.keys(req.body);
	for (let i = 0; i < bodyfields.length; i++) {
		const key = bodyfields[i];
		const val = req.body[key];
		if (!allowedArrays.has(key) && Array.isArray(val)) {
			return res.status(400).render('message', {
				'title': 'Bad request',
				'message': 'Malformed input'
			});
		}
	}

	for (let i = 0; i < trimFields.length; i++) {
		const field = trimFields[i];
		if (req.body[field]) {
			req.body[field] = req.body[field].trim();
		}
	}

	for (let i = 0; i < numberFields.length; i++) {
		const field = numberFields[i];
		if (req.body[field]) {
			const num = parseInt(req.body[field]);
			if (Number.isSafeInteger(num)) {
				req.body[field] = num;
			} else {
				req.body[field] = null;
			}
		}
	}

	//convert checked post ids to mongoid/number
	if (req.body.checkedposts) {
		req.body.checkedposts = req.body.checkedposts.map(Number);
	}
	if (req.body.globalcheckedposts) {
		req.body.globalcheckedposts = req.body.globalcheckedposts.map(Mongo.ObjectId)
	}

	//ban duration convert to ban time in ms
	if (req.body.ban_duration) {
		const matches = req.body.ban_duration.match(banDurationRegex);
		if (matches && matches.groups) {
			const groups = matches.groups;
			let banDuration = 0;
			const groupKeys = Object.keys(groups);
			for (let i = 0; i < groupKeys.length; i++) {
				const key = groupKeys[i];
				if (!groups[key]) {
					continue;
				}
				const mult = +groups[key].substring(0,groups[key].length-1); //remove the d, m, y, etc from end of the value
				if (Number.isSafeInteger(mult) //if the multiplier is safe int
					&& Number.isSafeInteger(mult*banDurations[key]) //and multiplying it is safe int
					&& Number.isSafeInteger((mult*banDurations[key])+banDuration)) { //and adding it to the total is safe
					banDuration += mult*banDurations[key];
				}
			}
			req.body.ban_duration = banDuration;
		} else {
			req.body.ban_duration = null;
		}
	}

	if (req.params.id) {
		req.params.id = +req.params.id;
	}

	//board page
	if (req.params.page) {
		req.params.page = req.params.page === 'index' ? 'index' : +req.params.page;
	}

	next();

}
