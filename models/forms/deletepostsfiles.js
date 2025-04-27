'use strict';

const { Files } = require(__dirname + '/../../db/')
	, config = require(__dirname + '/../../lib/misc/config.js')
	, { func: pruneFiles } = require(__dirname + '/../../schedules/tasks/prune.js')
	, deletePostFiles = require(__dirname + '/../../lib/file/deletepostfiles.js');

module.exports = async (req, res) => {

	const { posts, __, __n } = res.locals;
	const { pruneImmediately } = config.get;
	const filenameToDelete = res.locals.filename;

	// Get file metadata from posts
	let files = [];
	for (let i = 0; i < posts.length; i++) {
		const post = posts[i];
		if (post.files.length > 0) {
			for (const file of post.files) {
				if (!req.body.file_action_filename || file.filename === req.body.file_action_filename) {
					files.push({
						filename: file.filename,
						hash: file.hash,
						thumbextension: file.thumbextension,
						hasThumb: file.hasThumb,
					});
				}
			}
		}
	}
	files = [...new Set(files)];

	if (filenameToDelete) {
		files = files.filter(file => {
			return file.filename === filenameToDelete;
		});
	}

	if (files.length == 0) {
		return {
			message: __('No files found')
		};
	}

	const fileNames = files.map(x => x.filename);
	await Files.decrement(fileNames);
	if (pruneImmediately) {
		await pruneFiles(fileNames);
	}

	await deletePostFiles(files);
	return {
		message: __n('Deleted %s files from server', files.length),
		//NOTE: only deletes from selected posts. other posts with same image will 404
		action: '$pull',
		query: {
			'files': {
				'filename': { $in: fileNames }
			}
		}
	};
};
