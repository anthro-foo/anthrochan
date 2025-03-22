'use strict';

const uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, { remove } = require('fs-extra')
	, { Posts } = require(__dirname+'/../../db/')
	, Socketio = require(__dirname+'/../../lib/misc/socketio.js')
	, { prepareMarkdown } = require(__dirname+'/../../lib/post/markdown/markdown.js')
	, messageHandler = require(__dirname+'/../../lib/post/message.js')
	, quoteHandler = require(__dirname+'/../../lib/post/quotes.js');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	
	// Sort affected posts
	const { thread, postIds, postMongoIds } = res.locals.posts
		.sort((a, b) => {
			return a.date - b.date; //could do postId, doesn't really matter.
		}).reduce((acc, p) => {
			acc.postIds.push(p.postId);
			acc.postMongoIds.push(p._id);
			if (p.thread === null) {
				acc.thread = p;
			}
			return acc;
		}, { thread: null, postIds: [], postMongoIds: [] });
	
	const bulkWrites = [];

	// Clear all backlinks and quotes.
	bulkWrites.push({
		'updateMany': {
			'filter': {
				'_id': {
					'$in': postMongoIds
				}
			},
			'update': {
				'$set': {
					'backlinks': [],
					'quotes': [],
					'crossquotes': [],
				}
			}
		}
	});

	const sourceBoard = res.locals.board._id;
	const destinationBoard = res.locals.destinationBoard._id;
	let destinationThreadId = null, movedPosts = 0, _idToNewPostId;
	({ destinationThreadId, movedPosts, _idToPostId: _idToNewPostId} = await Posts.move(postMongoIds, destinationBoard));
	
	const postsToRebuild = new Set();
	const OldToNewPostId = new Map();
	for (let j = 0; j < res.locals.posts.length; j++) {
		const post = res.locals.posts[j];
		postsToRebuild.add(post._id);
		OldToNewPostId[post.postId] = _idToNewPostId[post._id]; 

		//remove dead backlinks to this post
		if (post.quotes.length > 0) {
			bulkWrites.push({
				'updateMany': {
					'filter': {
						'_id': {
							'$in': post.quotes.map(q => q._id)
						}
					},
					'update': {
						'$pull': {
							'backlinks': {
								'postId': post.postId
							}
						}
					}
				}
			});
		}
	}
	
	//no destination thread specified (making new thread from posts), need to fetch OP as destinationThread for remarkup
	res.locals.destinationThread = await Posts.getPost(destinationBoard, destinationThreadId);

	// Remarkup moved posts that are quoted
	if (postsToRebuild.size > 0) {
		const remarkupPosts = await Posts.globalGetPosts([...postsToRebuild]);
		await Promise.all(remarkupPosts.map(async post => { //doing these all at once
			const postUpdate = {};
			//update post message and/or id
			if (post.nomarkup && post.nomarkup.length > 0) {
				let nomarkup = prepareMarkdown(post.nomarkup, false);
				// replace old >>postId with new >>postId
				nomarkup = await quoteHandler.replace(nomarkup, sourceBoard, OldToNewPostId);
				const { message, quotes, crossquotes } = await messageHandler(nomarkup, post.board, post.thread, null);
				bulkWrites.push({
					'updateMany': {
						'filter': {
							'_id': {
								'$in': quotes.map(q => q._id)
							}
						},
						'update': {
							'$push': {
								'backlinks': { _id: post._id, postId: post.postId }
							}
						}
					}
				});
				postUpdate.quotes = quotes;
				postUpdate.crossquotes = crossquotes;
				postUpdate.nomarkup = nomarkup;
				postUpdate.message = message;
			}
			if (Object.keys(postUpdate).length > 0) {
				bulkWrites.push({
					'updateOne': {
						'filter': {
							'_id': post._id
						},
						'update': {
							'$set': postUpdate
						}
					}
				});
			}
		}));
	}

	//bulkwrite it all
	if (bulkWrites.length > 0) {
		await Posts.db.bulkWrite(bulkWrites);
	}

	//delete html/json for no longer existing threads, because op was moved
	if (thread) {
		await Promise.all([
			remove(`${uploadDirectory}/html/${thread.board}/thread/${thread.postId}.html`),
			remove(`${uploadDirectory}/html/${thread.board}/thread/${thread.postId}+50.html`),
			remove(`${uploadDirectory}/json/${thread.board}/thread/${thread.postId}.json`),
			remove(`${uploadDirectory}/json/${thread.board}/thread/${thread.postId}+50.json`),
		]);
	}
	
	//emit markPost moves
	/* for (let i = 0; i < moveEmits.length; i++) {
		Socketio.emitRoom(moveEmits[i].room, 'markPost', { postId: moveEmits[i].postId, type: 'move' });
	} */

	return {
		message: __('Moved posts'),
		action: movedPosts > 0,
	};

};
