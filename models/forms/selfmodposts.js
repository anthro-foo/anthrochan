'use strict';

const { NumberInt } = require(__dirname + '/../../db/db.js');

module.exports = (locals) => {

	const { posts, __, __n } = locals;

	const filteredposts = posts.filter(post => {
		return !post.thread;
	});

	if (filteredposts.length === 0) {
		return {
			message: __('No threads selected to Lock'),
		};
	}

	return {
		message: __n('Toggled selfmod for %s threads', filteredposts.length),
		action: '$bit',
		query: {
			'selfmod': {
				'xor': NumberInt(1)
			},
		}
	};

};