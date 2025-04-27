'use strict';

const { Posts } = require(__dirname + '/../../db/');

module.exports = async (req, res) => {

	const { __, __n, posts } = res.locals;

	if (req.body.file_action_filename) {
		await Posts.spoilerFile(req.body.file_action_filename);
		return {
			message: __n('Spoilered 1 file')
		};
	} else {
		// filter to ones not spoilered
		const filteredPosts = posts.filter(post => {
			return !post.spoiler && post.files.length > 0;
		});

		if (filteredPosts.length === 0) {
			return {
				message: __('No files to spoiler'),
			};
		}

		return {
			message: __n('Spoilered %s posts', filteredPosts.length),
			action: '$set',
			query: {
				'spoiler': true
			}
		};
	}
};
