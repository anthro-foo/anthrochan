'use strict';

const { TrustedIps, Posts, Boards, Modlogs } = require(__dirname + '/../../db/')
	, Mongo = require(__dirname + '/../../db/db.js')
	, untrustPoster = require(__dirname + '/untrustposter.js')
	, banPoster = require(__dirname + '/banposter.js')
	, deletePosts = require(__dirname + '/deletepost.js')
	, spoilerPosts = require(__dirname + '/spoilerpost.js')
	, stickyPosts = require(__dirname + '/stickyposts.js')
	, bumplockPosts = require(__dirname + '/bumplockposts.js')
	, lockPosts = require(__dirname + '/lockposts.js')
	, selfmodPosts = require(__dirname + '/selfmodposts.js')
	, cyclePosts = require(__dirname + '/cycleposts.js')
	, deletePostsFiles = require(__dirname + '/deletepostsfiles.js')
	, reportPosts = require(__dirname + '/reportpost.js')
	, dismissReports = require(__dirname + '/dismissreport.js')
	, movePosts = require(__dirname + '/moveposts.js')
	, moderateFiles = require(__dirname + '/moderatefiles.js')
	, { remove } = require('fs-extra')
	, uploadDirectory = require(__dirname + '/../../lib/file/uploaddirectory.js')
	, ModlogActions = require(__dirname + '/../../lib/input/modlogactions.js')
	, getAffectedBoards = require(__dirname + '/../../lib/misc/affectedboards.js')
	, dynamicResponse = require(__dirname + '/../../lib/misc/dynamic.js')
	, { Permissions } = require(__dirname + '/../../lib/permission/permissions.js')
	, buildQueue = require(__dirname + '/../../lib/build/queue.js')
	, { postPasswordSecret } = require(__dirname + '/../../configs/secrets.js')
	, threadRegex = /\/[a-z0-9]+\/(?:manage\/)?thread\/(\d+)\.html/i
	, { createHash, timingSafeEqual } = require('crypto');

module.exports = async (req, res, next) => {

	const { __ } = res.locals;

	//try to set a good redirect
	let redirect = req.headers.referer;
	if (!redirect) {
		if (!req.params.board) {
			redirect = '/globalmanage/recent.html';
		} else {
			redirect = `/${req.params.board}/${req.path.endsWith('modactions') ? 'manage/reports' : 'index'}.html`;
		}
	}

	/*
		Handle checking passwords (in a time-constant) when doing actions that require a password.
		Staff skip this section because they don't need passwords to do such actions.
	*/
	const isApprover = res.locals.permissions.get(Permissions.MANAGE_FILE_APPROVAL);
	const isMod = res.locals.permissions.get(Permissions.MANAGE_GENERAL);
	let selfMod = false;

	let spoileringFile = false;
	if (req.body.spoiler && res.locals.posts.length === 1 && req.body.file_action_filename && isApprover) {
		spoileringFile = true;
	}
	if (!spoileringFile && !isMod && res.locals.actions.numPasswords > 0) {
		let passwordPosts = [];
		if (req.body.postpassword && req.body.postpassword.length > 0) {
			const inputPasswordHash = createHash('sha256').update(postPasswordSecret + req.body.postpassword).digest('base64');
			const inputPasswordBuffer = Buffer.from(inputPasswordHash);
			passwordPosts = res.locals.posts.filter(post => {
				if (post.oppassword != null) {
					selfMod = true;
					const postBuffer = Buffer.from(post.oppassword);
					return timingSafeEqual(inputPasswordBuffer, postBuffer);

				} else if (post.password != null) { //null password doesnt matter for timing attack, it cant be deleted by non-staff
					const postBuffer = Buffer.from(post.password);
					return timingSafeEqual(inputPasswordBuffer, postBuffer);
				}
			});
		}
		if (passwordPosts.length === 0) {
			return dynamicResponse(req, res, 403, 'message', {
				'title': __('Forbidden'),
				'error': __('Password did not match any selected posts'),
				redirect,
			});
		}
		//if the password is correct for at least *some* posts, silently ignore the wrong ones (dont action them), and continue.
		res.locals.posts = passwordPosts;
	}

	const messages = [];
	const modlogActions = [];
	const combinedQuery = {};
	let recalculateThreadMetadata = false;

	const deleting = req.body.delete || req.body.delete_ip_board || req.body.delete_ip_global || req.body.delete_ip_thread;

	//affected boards, their threads, and how many pages each one has before the actions
	let { boardThreadMap, numPagesBeforeActions, affectedBoardNames } = await getAffectedBoards(res.locals.posts, deleting);
	let minimalThreadsMap = await Posts.getMinimalThreads(affectedBoardNames);

	//adjust the redirect to go back to the thread if it was done from there
	if (deleting
		&& req.params.board
		&& req.headers.referer
		&& boardThreadMap[req.params.board]) {
		const threadRefMatch = req.headers.referer.match(threadRegex);
		if (threadRefMatch && boardThreadMap[req.params.board].directThreads.has(+threadRefMatch[1])) {
			redirect = `/${req.params.board}/${req.path.endsWith('modactions') ? 'manage/' : ''}index.html`;
		}
	}

	// handle trust ip
	if (req.body.trust_ip) {
		const ip = res.locals.posts[0].ip;
		await TrustedIps.insert(ip);
		messages.push('Trusted IP.');
	}

	// handle trust
	if (req.body.untrust) {
		const { message } = await untrustPoster(req, res, next);
		modlogActions.push(ModlogActions.UNTRUST_USER);
		messages.push(message);
	}

	// handle bans, independent of other actions
	if (req.body.ban || req.body.global_ban || req.body.report_ban || req.body.global_report_ban) {
		const { message, action, query } = await banPoster(req, res, next);
		if (req.body.ban) {
			modlogActions.push(ModlogActions.BAN);
		} else if (req.body.global_ban) {
			modlogActions.push(ModlogActions.GLOBAL_BAN);
		}
		if (req.body.report_ban) {
			modlogActions.push(ModlogActions.BAN_REPORTER);
		} else if (req.body.global_report_ban) {
			modlogActions.push(ModlogActions.GLOBAL_BAN_REPORTER);
		}
		if (action) {
			combinedQuery[action] = { ...combinedQuery[action], ...query };
		}
		messages.push(message);
	}

	if (deleting) {

		//OP delete protection. for old OPs or with a lot of replies
		if (!isMod) { //TODO: make this use a permission bit
			const { deleteProtectionAge, deleteProtectionCount } = res.locals.board.settings;
			if (deleteProtectionAge > 0 || deleteProtectionCount > 0) {
				const protectedThread = res.locals.posts.some(p => {
					return p.thread === null //is a thread
						&& ((deleteProtectionCount > 0 && p.replyposts > deleteProtectionCount) //and it has more replies than the protection count
							|| (deleteProtectionAge > 0 && new Date() > new Date(p.date.getTime() + deleteProtectionAge))); //or was created too long ago
				});
				if (protectedThread === true) {
					return dynamicResponse(req, res, 403, 'message', {
						'title': __('Forbidden'),
						'error': __('You cannot delete old threads or threads with too many replies'),
						redirect,
					});
				}
			}
		}

		const postsBefore = res.locals.posts.length;

		if (req.body.delete_ip_board || req.body.delete_ip_global || req.body.delete_ip_thread) {
			const deletePostIps = res.locals.posts.map(x => x.ip.cloak);
			const deletePostMongoIds = res.locals.posts.map(x => x._id);
			let query = {
				'_id': {
					'$nin': deletePostMongoIds
				},
				'ip.cloak': {
					'$in': deletePostIps
				}
			};
			if (req.body.delete_ip_thread) {
				const ips_threads = [...boardThreadMap[req.params.board].threads];
				query['board'] = req.params.board;
				query['$or'] = [
					{
						'thread': {
							'$in': ips_threads
						}
					},
					{
						'postId': {
							'$in': ips_threads
						}
					}
				];
			} else if (req.body.delete_ip_board) {
				query['board'] = req.params.board;
			}
			const deleteIpPosts = await Posts.db.find(query).toArray();
			res.locals.posts = res.locals.posts.concat(deleteIpPosts);
		}
		if (res.locals.posts.length > postsBefore) {
			//recalc for extra fetched posts
			({ boardThreadMap, numPagesBeforeActions, affectedBoardNames } = await getAffectedBoards(res.locals.posts, deleting));
			minimalThreadsMap = await Posts.getMinimalThreads(affectedBoardNames);
		}

		if (req.body.delete_file) {
			const { message } = await deletePostsFiles(res.locals, false); //delete files, not just unlink
			messages.push(message);
		}
		const { action, message } = await deletePosts(res.locals.posts, req.body.delete_ip_global ? null : req.params.board, res.locals);
		messages.push(message);
		if (action) {
			if (req.body.delete) {
				modlogActions.push(ModlogActions.DELETE);
			} else if (req.body.delete_ip_board) {
				modlogActions.push(ModlogActions.DELETE_BY_IP);
			} else if (req.body.delete_ip_global) {
				modlogActions.push(ModlogActions.GLOBAL_DELETE_BY_IP);
			}
			recalculateThreadMetadata = true;
		}

	} else if (req.body.move) {
		if (boardThreadMap[req.params.board].directThreads.size > 0) {
			const threadIds = [...boardThreadMap[req.params.board].directThreads];
			const fetchMovePosts = await Posts.db.find({
				'board': req.params.board,
				'thread': {
					'$in': threadIds
				}
			}).toArray();
			res.locals.posts = res.locals.posts.concat(fetchMovePosts);
		}
		const { message, action } = await movePosts(req, res);
		if (action) {
			modlogActions.push(ModlogActions.MOVE);
			recalculateThreadMetadata = true;
			if (res.locals.destinationBoard && res.locals.destinationThread) {
				res.locals.posts.push(res.locals.destinationThread);
				({ boardThreadMap, numPagesBeforeActions, affectedBoardNames } = await getAffectedBoards(res.locals.posts, deleting));
				minimalThreadsMap = await Posts.getMinimalThreads(affectedBoardNames);
			}
		}
		messages.push(message);
	} else {
		// handle approvals first, may lead to file deletion
		if (req.body.approve || req.body.deny) {
			const { log_message, message } = await moderateFiles(req, res);

			if (req.body.log_message) {
				req.body.log_message = req.body.log_message.concat(log_message);
			} else {
				req.body.log_message = log_message;
			}
			modlogActions.push(ModlogActions.MODERATE_FILES);
			messages.push(message);
		}

		// if it was getting deleted/moved, dont do these actions
		if (req.body.delete_file) {
			const { message, action, query } = await deletePostsFiles(req, res);
			if (action) {
				modlogActions.push(ModlogActions.DELETE_FILES);
				recalculateThreadMetadata = true;
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		} else if (req.body.spoiler) {
			const { message, action, query } = await spoilerPosts(req, res);
			if (action) {
				modlogActions.push(ModlogActions.SPOILER_FILES);
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}
		//lock, sticky, bumplock, cyclic
		if (req.body.bumplock) {
			const { message, action, query } = bumplockPosts(res.locals);
			if (action) {
				modlogActions.push(ModlogActions.BUMPLOCK);
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}
		if (req.body.lock) {
			const { message, action, query } = lockPosts(res.locals);
			if (action) {
				modlogActions.push(ModlogActions.LOCK);
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}
		if (req.body.sticky != null) {
			const { message, action, query } = stickyPosts(res.locals, req.body.sticky);
			if (action) {
				modlogActions.push(ModlogActions.STICKY);
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}
		if (req.body.cyclic) {
			const { message, action, query } = cyclePosts(res.locals);
			if (action) {
				modlogActions.push(ModlogActions.CYCLE);
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}
		if (req.body.selfmod) {
			const { message, action, query } = selfmodPosts(res.locals);
			if (action) {
				modlogActions.push(ModlogActions.SELFMOD);
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}
		// cannot report and dismiss at same time
		if (req.body.report || req.body.global_report) {
			const { message, action, query } = reportPosts(req, res);
			if (action) {
				//no modlog entry for making reports
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		} else if (req.body.dismiss || req.body.global_dismiss) {
			const { message, action, query } = dismissReports(req, res);
			if (action) {
				if (req.body.dismiss) {
					modlogActions.push(ModlogActions.DISMISS);
				} else if (req.body.global_dismiss) {
					modlogActions.push(ModlogActions.GLOBAL_DISMISS);
				}
				combinedQuery[action] = { ...combinedQuery[action], ...query };
			}
			messages.push(message);
		}

	}

	//execute the actions from the resulting combined query in one shot
	if (Object.keys(combinedQuery).length > 0) {
		await Posts.db.updateMany({
			'_id': {
				'$in': res.locals.posts.map(p => Mongo.ObjectId(p._id))
			}
		}, combinedQuery);
	}

	//fetch boards for templates if necessary. can be multiple boards from global actions
	let buildBoards = {};
	if (modlogActions.length > 0 || res.locals.actions.numBuild > 0) {
		buildBoards = (await Boards.db.find({
			'_id': {
				'$in': affectedBoardNames
			},
		}).toArray()).reduce((acc, curr) => {
			if (!acc[curr._id]) {
				acc[curr._id] = curr;
			}
			return acc;
		}, buildBoards);
	}

	const parallelPromises = [];

	//modlog
	if (modlogActions.length > 0) {
		const modlog = {};
		const logDate = new Date(); //all events current date
		const message = req.body.log_message || null;
		let logUser = null;
		//could even do if (req.session.user) {...}, but might cause cross-board log username contamination
		if (isMod || res.locals.permissions.get(Permissions.MANAGE_FILE_APPROVAL)) {
			logUser = req.session.user;
		} else if (selfMod) {
			logUser = `OP#${[...boardThreadMap[req.params.board].threads].join(',')} Selfmod`;
		}
		for (let i = 0; i < res.locals.posts.length; i++) {
			const post = res.locals.posts[i];
			if (!modlog[post.board]) {
				//per board actions, all actions combined to one event
				modlog[post.board] = {
					showLinks: !deleting,
					postLinks: [], //TODO: rename this to just "links"
					actions: modlogActions,
					public: req.body.approve && res.locals.actions.validActions.length === 1 ? false : true,
					date: logDate,
					showUser: !req.body.hide_name ? true : false,
					message: message,
					user: logUser,
					ip: {
						cloak: res.locals.ip.cloak,
						raw: res.locals.ip.raw
					}
				};
			}

			if ((req.body.move && !post.thread) || (!req.body.move)) {
				modlog[post.board].postLinks.push({
					postId: req.body.move ? res.locals.destinationThread.postId : post.postId,
					thread: res.locals.destinationThread ? res.locals.destinationThread.postId : post.thread,
					board: res.locals.destinationBoard ? res.locals.destinationBoard._id : post.board,
				});
			}
		}

		const modlogDocuments = [];
		for (let i = 0; i < affectedBoardNames.length; i++) {
			const boardName = affectedBoardNames[i];
			const boardLog = modlog[boardName];
			//make it into documents for the db
			modlogDocuments.push({
				...boardLog,
				'board': boardName
			});
		}
		if (modlogDocuments.length > 0) {
			//insert the modlog docs
			await Modlogs.insertMany(modlogDocuments);
			for (let i = 0; i < affectedBoardNames.length; i++) {
				const board = buildBoards[affectedBoardNames[i]];
				buildQueue.push({
					'task': 'buildModLog',
					'options': {
						'board': board,
					}
				});
				buildQueue.push({
					'task': 'buildModLogList',
					'options': {
						'board': board,
					}
				});
			}
		}
	}

	//if there are actions that can cause some rebuilding
	if (res.locals.actions.numBuild > 0) {

		//Make a map of all the unique threads for any posts we selected in those threads (and directly selected threads)
		const queryOrs = [];
		for (let i = 0; i < affectedBoardNames.length; i++) {
			const threadBoard = affectedBoardNames[i];
			//convert this to an array while we are here
			boardThreadMap[threadBoard].threads = [...boardThreadMap[threadBoard].threads];
			boardThreadMap[threadBoard].directThreads = [...boardThreadMap[threadBoard].directThreads];
			queryOrs.push({
				'board': threadBoard,
				'postId': {
					'$in': boardThreadMap[threadBoard].threads
				}
			});
		}
		let threadsEachBoard = [];
		if (queryOrs.length > 0) {
			threadsEachBoard = await Posts.db.find({
				'thread': null,
				'$or': queryOrs
			}).toArray();
		}
		const selectedThreads = res.locals.posts.filter(post => post.thread === null);
		threadsEachBoard = threadsEachBoard.concat(selectedThreads);

		//recalculate replies and image counts if necessary
		if (recalculateThreadMetadata) {
			const selectedPosts = res.locals.posts
				.filter(p => p.thread !== null);
			if (selectedPosts.length > 0) {
				const replyOrs = selectedPosts
					.map(p => ({ board: p.board, thread: p.thread }));
				if (req.body.move && res.locals.destinationBoard && res.locals.destinationThread) {
					replyOrs.push({ board: res.locals.destinationThread.board, thread: res.locals.destinationThread.postId });
				}
				const threadReplyAggregates = await Posts.getThreadAggregates(replyOrs);
				const bulkWrites = [];
				const threads = threadsEachBoard;
				for (let i = 0; i < threads.length; i++) {
					const replyAggregate = threadReplyAggregates.find(ra => ra._id.thread === threads[i].postId && ra._id.board === threads[i].board);
					if (!replyAggregate) {
						//thread no longer has any reply post/files, set to 0 and reset bump date to post date
						bulkWrites.push({
							'updateOne': {
								'filter': {
									'postId': threads[i].postId,
									'board': threads[i].board
								},
								'update': {
									'$set': {
										'replyposts': 0,
										'replyfiles': 0,
										'bumped': threads[i].date
									},
								}
							}
						});
					} else {
						//use results from first aggregate for threads with replies still existing
						const aggregateSet = {
							'replyposts': replyAggregate.replyposts,
							'replyfiles': replyAggregate.replyfiles,
						};
						if (!threads[i].bumplocked) {
							if (replyAggregate.bumped === 0) {
								aggregateSet['bumped'] = threads[i].date;
							} else {
								aggregateSet['bumped'] = replyAggregate.bumped;
							}
						}
						bulkWrites.push({
							'updateOne': {
								'filter': {
									'postId': replyAggregate._id.thread,
									'board': replyAggregate._id.board
								},
								'update': {
									'$set': aggregateSet,
								}
							}
						});
					}
				}
				if (bulkWrites.length > 0) {
					await Posts.db.bulkWrite(bulkWrites);
				}
			}
			await Posts.fixLatest(affectedBoardNames);
		}

		/*
			Get a minimal data of the threads for each affected board, used to get the page of a thread later.
			Using the proper ordering of threads, to account for sticky, bumplocks, etc.
		*/
		const pageBounds = threadsEachBoard.reduce((acc, t) => {
			if (!minimalThreadsMap[t.board]) { return acc; }
			if (!acc[t.board]) { acc[t.board] = { first: null, last: null }; }
			const threadIndex = minimalThreadsMap[t.board].findIndex(p => p.postId === t.postId);
			const threadPage = Math.max(1, Math.ceil((threadIndex + 1) / 10));
			if (!acc[t.board].first || threadPage < acc[t.board].first) {
				acc[t.board].first = threadPage;
			}
			if (!acc[t.board].last || threadPage > acc[t.board].last) {
				acc[t.board].last = threadPage;
			}
			return acc;
		}, {});

		for (let i = 0; i < affectedBoardNames.length; i++) {

			//always assume catalog rebuild, gets set to false in specific cases later
			let catalogRebuild = true;

			//get the board data for build tasks, and highest/lowest affected pages for rebuilding
			const boardName = affectedBoardNames[i];
			const board = buildBoards[boardName];

			//rebuild affected threads
			for (let j = 0; j < boardThreadMap[boardName].threads.length; j++) {
				buildQueue.push({
					'task': 'buildThread',
					'options': {
						'threadId': boardThreadMap[boardName].threads[j],
						'board': board,
					}
				});
			}

			//use to compare number of pages after actions. fetch from db again if any actions that can change number of pages (delete and move)
			let numPagesAfterActions = numPagesBeforeActions[boardName];
			if (deleting || req.body.move) {
				numPagesAfterActions = Math.ceil((await Posts.getPages(boardName)) / 10);
			}

			if ((numPagesBeforeActions[boardName] && numPagesBeforeActions[boardName] !== numPagesAfterActions) || req.body.move) {

				//if number of pages changed, or doing a "move", rebuild all pages for simplicity and delete any pages that would no longer exist
				if (numPagesAfterActions < numPagesBeforeActions[boardName]) {
					for (let k = numPagesBeforeActions[boardName]; k > numPagesAfterActions; k--) {
						parallelPromises.push(remove(`${uploadDirectory}/html/${boardName}/${k}.html`));
						parallelPromises.push(remove(`${uploadDirectory}/json/${boardName}/${k}.json`));
					}
				}
				buildQueue.push({
					'task': 'buildBoardMultiple',
					'options': {
						'board': board,
						'startpage': 1,
						'endpage': numPagesAfterActions,
					}
				});

			} else {

				//build between pages
				const rebuildPageFirst = pageBounds[boardName].first;
				const rebuildPageLast = pageBounds[boardName].last;

				if (deleting) {

					if (boardThreadMap[boardName].directThreads.length === 0) {
						//only deleting posts from threads, so thread order wont change, thus we dont delete all pages after
						buildQueue.push({
							'task': 'buildBoardMultiple',
							'options': {
								'board': board,
								'startpage': rebuildPageFirst,
								'endpage': rebuildPageLast,
							}
						});
					} else {
						//deleting threads, so we delete all pages after
						buildQueue.push({
							'task': 'buildBoardMultiple',
							'options': {
								'board': board,
								'startpage': rebuildPageFirst,
								'endpage': numPagesAfterActions,
							}
						});
					}

				} else if (req.body.sticky) {

					//rebuild current and newer pages
					buildQueue.push({
						'task': 'buildBoardMultiple',
						'options': {
							'board': board,
							'startpage': 1,
							'endpage': rebuildPageLast,
						}
					});

				} else if (req.body.lock || req.body.bumplock || req.body.cyclic) {

					buildQueue.push({
						'task': 'buildBoardMultiple',
						'options': {
							'board': board,
							'startpage': rebuildPageFirst,
							'endpage': rebuildPageLast,
						}
					});

				} else if (req.body.approve || req.body.spoiler || req.body.ban || req.body.global_ban) {

					buildQueue.push({
						'task': 'buildBoardMultiple',
						'options': {
							'board': board,
							'startpage': rebuildPageFirst,
							'endpage': numPagesAfterActions,
						}
					});
					//these actions dont affect the catalog tiles if no OPs selected, so dont bother rebuilding the catalog
					if (boardThreadMap[boardName].directThreads.length === 0) {
						catalogRebuild = false;
					}

				}

			}

			if (catalogRebuild) {

				buildQueue.push({
					'task': 'buildCatalog',
					'options': {
						'board': board,
					}
				});

			}

		}
	}

	if (parallelPromises.length > 0) {
		await Promise.all(parallelPromises);
	}

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'messages': messages,
		redirect,
	});

};
