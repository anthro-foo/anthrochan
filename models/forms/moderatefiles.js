'use strict';

const { Posts } = require(__dirname+'/../../db/')
	, Socketio = require(__dirname+'/../../lib/misc/socketio.js');

module.exports = async (req, res) => {
	if (!res.locals.posts) {
		return;
	}
	if (!(req.body.approve || req.body.deny)) {
		return;
	}

	let message = '';
	let log_message = '';

	if (req.body.approve) {
		if (req.body.file_moderation_filename) { // single
			const filename = req.body.file_moderation_filename;
			await Posts.approveFile(filename);
		} else { // bulk
			await Posts.bulkApproveFiles(res.locals.posts);
		}
		message = 'Approved';
		log_message = 'Approved';
	} else if (req.body.deny) {
		if (req.body.file_moderation_filename) { // single file operation
			res.locals.filename = req.body.file_moderation_filename;
		}
		req.body.delete_file = true;
		message = 'Denied';
		log_message = 'Denied';
	}

	// Get filehashes for logging
	let filehashes = [];
	if (req.body.file_moderation_filename) {
		const filename = req.body.file_moderation_filename;
		const filehash = filename.substring(0, 6);
		filehashes.push(filehash);
	} else {
		for (let i = 0; i<res.locals.posts.length; i++) {
			const post = res.locals.posts[i];
			if (post.files) {
				for (let i = 0; i<post.files.length; i++) {
					filehashes.push(post.files[i].filename.substring(0, 6));
				}
			}
		}
	}
		
	for (let i=0; i<filehashes.length; i++) {
		const hash = filehashes[i];
		log_message = log_message.concat(` ${hash}`);
	}

	if (req.body.approve) {
		for (let i = 0; i < res.locals.posts.length; i++) {
			const post = res.locals.posts[i];
			if (post.files) {
				for (let j = 0; j < post.files.length; j++) {
					const file = post.files[j];
					if (!req.body.file_moderation_filename ||
						(
							req.body.file_moderation_filename && 
							req.body.file_moderation_filename === file.filename
						)
					) {
						file.approved = true;
					}
				}			
			}
			
			Socketio.emitRoom(
				`${post.board}-${post.thread || post.postId}`,
				'approvePost', 
				{ ...post},
			);
		}	
	}
					
	return {
		log_message: log_message,
		message: `${message} ${filehashes.length}`,
	};
};