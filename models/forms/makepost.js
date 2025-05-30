'use strict';

const { createHash, randomBytes } = require('crypto')
	, randomBytesAsync = require('util').promisify(randomBytes)
	, { remove, emptyDir, pathExists, stat: fsStat } = require('fs-extra')
	, path = require('path')
	, uploadDirectory = require(__dirname + '/../../lib/file/uploaddirectory.js')
	, Mongo = require(__dirname + '/../../db/db.js')
	, Socketio = require(__dirname + '/../../lib/misc/socketio.js')
	, { TrustedIps, Stats, Posts, Boards, Files, Filters } = require(__dirname + '/../../db/')
	, cache = require(__dirname + '/../../lib/redis/redis.js')
	, nameHandler = require(__dirname + '/../../lib/post/name.js')
	, getFilterStrings = require(__dirname + '/../../lib/post/getfilterstrings.js')
	, checkFilters = require(__dirname + '/../../lib/post/checkfilters.js')
	, checkUrls = require(__dirname + '/../../lib/post/checkurls.js')
	, filterActions = require(__dirname + '/../../lib/post/filteractions.js')
	, { prepareMarkdown } = require(__dirname + '/../../lib/post/markdown/markdown.js')
	, messageHandler = require(__dirname + '/../../lib/post/message.js')
	, moveUpload = require(__dirname + '/../../lib/file/moveupload.js')
	, mimeTypes = require(__dirname + '/../../lib/file/mimetypes.js')
	, imageThumbnail = require(__dirname + '/../../lib/file/image/imagethumbnail.js')
	, getDimensions = require(__dirname + '/../../lib/file/image/getdimensions.js')
	, videoThumbnail = require(__dirname + '/../../lib/file/video/videothumbnail.js')
	, audioThumbnail = require(__dirname + '/../../lib/file/audio/audiothumbnail.js')
	, ffprobe = require(__dirname + '/../../lib/file/ffprobe.js')
	, formatSize = require(__dirname + '/../../lib/converter/formatsize.js')
	, { getCountryName } = require(__dirname + '/../../lib/misc/countries.js')
	, deleteTempFiles = require(__dirname + '/../../lib/file/deletetempfiles.js')
	, fixGifs = require(__dirname + '/../../lib/file/image/fixgifs.js')
	, timeUtils = require(__dirname + '/../../lib/converter/timeutils.js')
	, { Permissions } = require(__dirname + '/../../lib/permission/permissions.js')
	, deletePosts = require(__dirname + '/deletepost.js')
	, spamCheck = require(__dirname + '/../../lib/middleware/misc/spamcheck.js')
	, config = require(__dirname + '/../../lib/misc/config.js')
	, { postPasswordSecret } = require(__dirname + '/../../configs/secrets.js')
	, buildQueue = require(__dirname + '/../../lib/build/queue.js')
	, dynamicResponse = require(__dirname + '/../../lib/misc/dynamic.js')
	, { buildThread } = require(__dirname + '/../../lib/build/tasks.js')
	, FIELDS_TO_REPLACE = ['name', 'email', 'subject', 'message']
	, userIdHash = require(__dirname + '/../../lib/misc/useridhash.js');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	const { checkRealMimeTypes, thumbSize, thumbExtension, videoThumbPercentage, audioThumbnails,
		dontStoreRawIps, globalLimits } = config.get;

	//
	// Spam/flood check
	//
	const flood = await spamCheck(req, res);
	if (flood) {
		await deleteTempFiles(req).catch(console.error);
		return dynamicResponse(req, res, 429, 'message', {
			'title': __('Flood detected'),
			'message': __('Please wait before making another post, or a post similar to another user'),
			'redirect': `/${req.params.board}${req.body.thread ? '/thread/' + req.body.thread + '.html' : ''}`
		});
	}

	// Set redirect to board index in case of error
	let redirect = `/${req.params.board}/`;
	let salt = null;
	let thread = null;
	const isMod = res.locals.permissions.get(Permissions.VIEW_MANAGE);
	const canBypassLock = res.locals.permissions.hasAny(Permissions.MANAGE_GENERAL);
	const { blockedCountries, threadLimit, ids, userPostSpoiler,
		pphTrigger, tphTrigger, tphTriggerAction, pphTriggerAction,
		replyLimit, disableReplySubject,
		captchaMode, lockMode, allowedFileTypes, customFlags, geoFlags, fileR9KMode, messageR9KMode,
		requireFileApproval } = res.locals.board.settings;

	//
	// Check if country is blocked
	//
	if (!isMod
		// && !res.locals.permissions.get(Permissions.BYPASS_FILTERS) //TODO: new permission for "bypass blocks" or something
		&& res.locals.country
		&& blockedCountries.includes(res.locals.country.code)) {
		await deleteTempFiles(req).catch(console.error);
		return dynamicResponse(req, res, 403, 'message', {
			'title': __('Forbidden'),
			'message': __('Your country "%s" is not allowed to post on this board', getCountryName(res.locals.country.code, res.locals.locale)),
			'redirect': redirect
		});
	}

	//
	// Check if board/thread creation locked
	//
	if ((lockMode === 2 || (lockMode === 1 && !req.body.thread)) //if board lock, or thread lock and its a new thread
		&& !canBypassLock) { // and not admin
		await deleteTempFiles(req).catch(console.error);
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad request'),
			'message': __(lockMode === 1 ? 'Thread creation locked' : 'Board locked'),
			'redirect': redirect
		});
	}

	//
	// Check if thread exists
	//
	if (req.body.thread) {
		thread = await Posts.getPost(req.params.board, req.body.thread, true);
		if (!thread || thread.thread != null) {
			await deleteTempFiles(req).catch(console.error);
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Thread does not exist'),
				'redirect': redirect
			});
		}

		// Set salt for IDs
		salt = thread.salt;

		// Redirect to thread on reply
		redirect += `thread/${req.body.thread}.html`;

		// If thread locked, delete reply
		if (thread.locked && !canBypassLock) {
			await deleteTempFiles(req).catch(console.error);
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Thread locked'),
				'redirect': redirect
			});
		}

		// If thread reply limit reached, delete reply
		if (thread.replyposts >= replyLimit && !thread.cyclic) {
			await deleteTempFiles(req).catch(console.error);
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Thread reached reply limit'),
				'redirect': redirect
			});
		}
	}

	//
	// Filters
	//
	if (!res.locals.permissions.get(Permissions.BYPASS_FILTERS)) {

		//deconstruct global filter settings to differnt names, else they would conflict with the respective board-level setting
		const [globalFilters] = await Promise.all([
			Filters.findForBoard(null),
		]);

		let hitFilters = false
			, globalFilter = false;
		let { combinedString, strictCombinedString } = getFilterStrings(req, res);

		//compare to global filters
		hitFilters = checkFilters(globalFilters, combinedString, strictCombinedString);
		if (hitFilters) {
			globalFilter = true;
		}

		if (hitFilters) {
			//if block or ban matched, only it is returned
			if (hitFilters[0].f.filterMode === 1 || hitFilters[0].f.filterMode === 2) {
				await deleteTempFiles(req).catch(console.error);
				return filterActions(req, res, globalFilter, hitFilters[0].h, hitFilters[0].f, redirect);
			} else {
				for (const o of hitFilters) {
					await filterActions(req, res, globalFilter, o.h, o.f, redirect);
				}

				for (const field of FIELDS_TO_REPLACE) {
					//check filters haven't pushed a field past its limit
					if (req.body[field] && (req.body[field].length > globalLimits.fieldLength[field])) {
						await deleteTempFiles(req).catch(console.error);
						return dynamicResponse(req, res, 400, 'message', {
							'title': __('Bad request'),
							'message': __(`After applying filters, ${field} exceeds maximum length of %s`, globalLimits.fieldLength[field]),
							'redirect': redirect
						});
					}
				}
			}
		}

	}

	const isTrusted = res.locals.permissions.hasAny(Permissions.BYPASS_FILE_APPROVAL) || (await TrustedIps.exists(res.locals.ip));
	if (!isTrusted) {
		req.body.message = checkUrls(req.body.message);
	}

	//for r9k messages. usually i wouldnt process these if its not enabled e.g. flags and IDs but in this case I think its necessary
	let messageHash = null;
	if (req.body.message && req.body.message.length > 0) {
		const noQuoteMessage = req.body.message.replace(/>>\d+/g, '').replace(/>>>\/\w+(\/\d*)?/gm, '').trim();
		messageHash = createHash('sha256').update(noQuoteMessage).digest('base64');
		if ((req.body.thread && messageR9KMode === 1) || messageR9KMode === 2) {
			const postWithExistingMessage = await Posts.checkExistingMessage(res.locals.board._id, (messageR9KMode === 2 ? null : req.body.thread), messageHash);
			if (postWithExistingMessage != null) {
				await deleteTempFiles(req).catch(console.error);
				return dynamicResponse(req, res, 409, 'message', {
					'title': __('Conflict'),
					'message': __(`Messages must be unique ${messageR9KMode === 1 ? 'in this thread' : 'on this board'}. Your message is not unique.`),
					'redirect': redirect
				});
			}
		}
	}

	//
	// File processing
	//
	let files = [];
	if (res.locals.numFiles > 0) {

		// Unique file check
		if ((req.body.thread && fileR9KMode === 1) || fileR9KMode === 2) {
			const filesHashes = req.files.file.map(f => f.sha256);
			const postWithExistingFiles = await Posts.checkExistingFiles(res.locals.board._id, (fileR9KMode === 2 ? null : req.body.thread), filesHashes);
			if (postWithExistingFiles != null) {
				await deleteTempFiles(req).catch(console.error);
				const conflictingFiles = req.files.file
					.filter(f => postWithExistingFiles.files.some(fx => fx.hash === f.sha256))
					.map(f => f.name)
					.join(', ');
				const r9kFilesMessage = __(`Uploaded files must be unique ${fileR9KMode === 1 ? 'in this thread' : 'on this board'}.`)
					+ '\n'
					+ conflictingFiles.length > 1 //slightly gross but __mf() is more so
					? __('At least the following file is not unique: %s', conflictingFiles)
					: __('At least the following files are not unique: %s', conflictingFiles);
				return dynamicResponse(req, res, 409, 'message', {
					'title': 'Conflict',
					'message': r9kFilesMessage,
					'redirect': redirect,
				});
			}
		}

		// Fast mime type check
		for (let i = 0; i < res.locals.numFiles; i++) {
			if (!mimeTypes.allowed(req.files.file[i].mimetype, allowedFileTypes)) {
				await deleteTempFiles(req).catch(console.error);
				return dynamicResponse(req, res, 400, 'message', {
					'title': __('Bad request'),
					'message': __('Mime type "%s" for "%s" not allowed', req.files.file[i].mimetype, req.files.file[i].name),
					'redirect': redirect
				});
			}
		}

		// Slow proper mime type check
		if (checkRealMimeTypes) {
			for (let i = 0; i < res.locals.numFiles; i++) {
				if (!(await mimeTypes.realMimeCheck(req.files.file[i]))) {
					deleteTempFiles(req).catch(console.error);
					return dynamicResponse(req, res, 400, 'message', {
						'title': __('Bad request'),
						'message': req.files.file[i].realMimetype
							? __('Mime type "%s" invalid for file "%s"', req.files.file[i].realMimetype, req.files.file[i].name)
							: __('Mime type invalid for file "%s"', req.files.file[i].name),
						'redirect': redirect
					});
				}
			}
		}

		// upload, create thumbnails, get metadata, etc.
		for (let i = 0; i < res.locals.numFiles; i++) {
			const file = req.files.file[i];

			// Check if file approved
			// if ((await Approval.isDenied(file.sha256)) === true) {
			// 	console.error('User tried to upload bad file');
			// 	deleteTempFiles(req).catch(console.error);
			// 	return dynamicResponse(req, res, 429, 'message', {
			// 		'title': __('Bad file'),
			// 		'message': __('You can not upload that file'),
			// 		'redirect': `/${req.params.board}${req.body.thread ? '/thread/' + req.body.thread + '.html' : ''}`
			// 	});
			// }

			file.filename = file.sha256 + file.extension;

			//get metadata
			let processedFile = {
				filename: file.filename,
				spoiler: (!isMod || userPostSpoiler) && req.body.spoiler && req.body.spoiler.includes(file.sha256),
				hash: file.sha256,
				originalFilename: req.body.strip_filename && req.body.strip_filename.includes(file.sha256) ? file.filename : file.name,
				mimetype: file.mimetype,
				size: file.size,
				extension: file.extension,
			};

			const altTextKey = `alt_text_${file.sha256}`;
			const altText = req.body[altTextKey]?.trim();
			if (altText) {
				processedFile.altText = altText;
			}

			//phash
			if (file.phash) {
				processedFile.phash = file.phash;
			}

			//type and subtype
			let [type, subtype] = processedFile.mimetype.split('/');
			//check if already exists
			const existsFull = await pathExists(`${uploadDirectory}/file/${processedFile.filename}`);
			processedFile.sizeString = formatSize(processedFile.size);
			const saveFull = async () => {
				await Files.increment(processedFile);
				req.files.file[i].inced = true;
				if (!existsFull) {
					await moveUpload(file, processedFile.filename, 'file');
				}
			};
			if (mimeTypes.getOther().has(processedFile.mimetype)) {
				//"other" mimes from config, overrides main type to avoid codec issues in browser or ffmpeg for unsupported filetypes
				processedFile.hasThumb = false;
				processedFile.attachment = true;
				await saveFull();
			} else {
				const existsThumb = await pathExists(`${uploadDirectory}/file/thumb/${processedFile.hash}${processedFile.thumbextension}`);
				try {
					switch (type) {
						case 'image': {
							processedFile.thumbextension = thumbExtension;
							const imageDimensions = await getDimensions(req.files.file[i].tempFilePath, null, true);
							if (Math.floor(imageDimensions.width * imageDimensions.height) > globalLimits.postFilesSize.imageResolution) {
								await deleteTempFiles(req).catch(console.error);
								return dynamicResponse(req, res, 400, 'message', {
									'title': 'Bad request',
									'message': `File "${req.files.file[i].name}" image resolution is too high. Width*Height must not exceed ${globalLimits.postFilesSize.imageResolution}.`,
									'redirect': redirect
								});
							}
							if (thumbExtension === '.jpg' && subtype === 'png') {
								//avoid transparency issues for jpg thumbnails on pngs (the most common case -- for anything else, use webp thumbExtension)
								processedFile.thumbextension = '.png';
							}
							processedFile.geometry = imageDimensions;
							processedFile.geometryString = `${imageDimensions.width}x${imageDimensions.height}`;
							const lteThumbSize = (processedFile.geometry.height <= thumbSize
								&& processedFile.geometry.width <= thumbSize);
							processedFile.hasThumb = !(mimeTypes.allowed(file.mimetype, { image: true })
								&& subtype !== 'png'
								&& lteThumbSize);
							await saveFull();
							if (!existsThumb) {
								await imageThumbnail(processedFile);
							}
							processedFile = fixGifs(processedFile);
							break;
						}
						case 'audio':
						case 'video': {
							//video metadata
							const audioVideoData = await ffprobe(req.files.file[i].tempFilePath, null, true);
							processedFile.duration = audioVideoData.format.duration;
							processedFile.durationString = timeUtils.durationString(audioVideoData.format.duration * 1000);
							const videoStreams = audioVideoData.streams.filter(stream => stream.width != null); //filter to only video streams or something with a resolution
							if (videoStreams.length > 0) {
								processedFile.thumbextension = thumbExtension;
								processedFile.codec = videoStreams[0].codec_name;
								processedFile.geometry = { width: videoStreams[0].coded_width, height: videoStreams[0].coded_height };
								if (Math.floor(processedFile.geometry.width * processedFile.geometry.height) > globalLimits.postFilesSize.videoResolution) {
									await deleteTempFiles(req).catch(console.error);
									return dynamicResponse(req, res, 400, 'message', {
										'title': 'Bad request',
										'message': `File "${req.files.file[i].name}" video resolution is too high. Width*Height must not exceed ${globalLimits.postFilesSize.videoResolution}.`,
										'redirect': redirect
									});
								}
								processedFile.geometryString = `${processedFile.geometry.width}x${processedFile.geometry.height}`;
								processedFile.hasThumb = true;
								await saveFull();
								if (!existsThumb) {
									const numFrames = videoStreams[0].nb_frames;
									const timestamp = ((numFrames === 'N/A' && subtype !== 'webm') || numFrames <= 1) ? 0 : processedFile.duration * videoThumbPercentage / 100;
									try {
										await videoThumbnail(processedFile, processedFile.geometry, timestamp);
									} catch (err) {
										//No keyframe after timestamp probably. ignore, we'll retry
										console.warn(err); //printing log because this error can actually be useful and we dont wanna mask it
									}
									let videoThumbStat = null;
									try {
										videoThumbStat = await fsStat(`${uploadDirectory}/file/thumb/${processedFile.hash}${processedFile.thumbextension}`);
									} catch (err) { /*ENOENT probably, ignore*/ }
									if (!videoThumbStat || videoThumbStat.code === 'ENOENT' || videoThumbStat.size === 0) {
										//create thumb again at 0 timestamp and lets hope it exists this time
										await videoThumbnail(processedFile, processedFile.geometry, 0);
									}
								}
							} else {
								//audio file, or video with only audio streams
								type = 'audio';
								processedFile.mimetype = `audio/${subtype}`;
								processedFile.thumbextension = '.png';
								processedFile.hasThumb = audioThumbnails;
								processedFile.geometry = { thumbwidth: thumbSize, thumbheight: thumbSize };
								await saveFull();
								if (processedFile.hasThumb && !existsThumb) {
									await audioThumbnail(processedFile);
								}
							}
							break;
						}
						default:
							throw new Error(__('invalid file mime type: %s', processedFile.mimetype));
					}
				} catch (e) {
					console.error(e);
					await deleteTempFiles(req).catch(console.error);
					return dynamicResponse(req, res, 400, 'message', {
						'title': __('Bad request'),
						'message': __('The server failed to process "%s". Possible unsupported or corrupt file.', req.files.file[i].name),
						'redirect': redirect
					});
				}
			}

			if (processedFile.hasThumb === true && processedFile.geometry && processedFile.geometry.width != null) {
				if (processedFile.geometry.width < thumbSize && processedFile.geometry.height < thumbSize) {
					//dont scale up thumbnail for smaller images
					processedFile.geometry.thumbwidth = processedFile.geometry.width;
					processedFile.geometry.thumbheight = processedFile.geometry.height;
				} else {
					const ratio = Math.min(thumbSize / processedFile.geometry.width, thumbSize / processedFile.geometry.height);
					processedFile.geometry.thumbwidth = Math.floor(Math.min(processedFile.geometry.width * ratio, thumbSize));
					processedFile.geometry.thumbheight = Math.floor(Math.min(processedFile.geometry.height * ratio, thumbSize));
				}
			}

			//delete the temp file
			await remove(file.tempFilePath);

			files.push(processedFile);
		}
	}
	// because express middleware is autistic i need to do this
	deleteTempFiles(req).catch(console.error);

	//
	// File approval
	//
	const bypassFileApproval = !requireFileApproval || isTrusted;

	if (files.length > 0) {
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			file.approved = bypassFileApproval;
		}
	}

	//
	// User ID, flag, and password
	//
	let userId = null;
	if (!salt) {
		//thread salt for IDs
		salt = (await randomBytesAsync(128)).toString('base64');
	}
	if (ids === true) {
		userId = userIdHash(salt, res.locals.ip);
	}
	let country = null;
	if (geoFlags === true) {
		country = {
			code: res.locals.country.code,
			name: getCountryName(res.locals.country.code, res.locals.locale),
		};
	}
	if (customFlags === true) {
		if (req.body.customflag) {
			const name = path.parse(req.body.customflag).name;
			//if customflags allowed, and its a valid selection
			country = {
				name: name,
				code: name,
				src: req.body.customflag,
				custom: true, //this will help
			};
		}
	}
	let password = null;
	if (req.body.postpassword) {
		password = createHash('sha256').update(postPasswordSecret + req.body.postpassword).digest('base64');
	}
	let oppassword = null;
	if (req.body.thread) {
		const thread = await Posts.getPost(res.locals.board._id, req.body.thread, true);
		if (thread.selfmod) {
			oppassword = thread.password;
		}
	}

	//spoiler files only if board settings allow
	const spoiler = (!isMod || userPostSpoiler) && req.body.spoiler_all ? true : false;

	//forceanon and sageonlyemail only allow sage email
	const options = req.body.options;
	let nohide = false;
	let selfmod = false;
	let sage = false;
	if (options) {
		nohide = options.includes('nohide');
		selfmod = options.includes('selfmod');
		sage = options.includes('sage');
	}
	//disablereplysubject
	let subject = (!isMod && req.body.thread && disableReplySubject) ? null : req.body.subject;

	//get name, trip and cap
	const { name, tripcode, capcode } = await nameHandler(
		req.body.name,
		res.locals.permissions,
		res.locals.board.settings,
		__ //i18n translation local
	);
	//get message, quotes and crossquote array
	const nomarkup = prepareMarkdown(req.body.message, true);
	const { message, quotes, crossquotes } = await messageHandler(nomarkup, req.params.board, req.body.thread, res.locals.permissions);

	//web3 sig
	let signature = null
		, address = null;
	if (res.locals.recoveredAddress) {
		signature = req.body.signature;
		address = res.locals.recoveredAddress;
	}

	//build post data for db. for some reason all the property names are lower case :^)
	const now = Date.now();
	const data = {
		'date': new Date(now),
		'u': now,
		name,
		country,
		'board': req.params.board,
		tripcode,
		capcode,
		subject,
		'message': message || null,
		'messagehash': messageHash || null,
		'nomarkup': nomarkup || null,
		'thread': req.body.thread || null,
		password,
		oppassword,
		spoiler,
		signature,
		address,
		'banmessage': null,
		userId,
		'ip': res.locals.ip,
		files,
		'reports': [],
		'globalreports': [],
		quotes, //posts this post replies to
		crossquotes, //quotes to other threads in same board
		'backlinks': [], //posts replying to this post
		account: res.locals.user ? res.locals.user.username : null,
		nohide: nohide,
		trusted: isTrusted,
		sage: sage,
	};

	if (!req.body.thread) {
		//if this is a thread, add thread specific properties
		Object.assign(data, {
			'replyposts': 0,
			'replyfiles': 0,
			//NOTE: sticky is a number, 0 = not sticky, higher numbers are a priority and will be sorted in descending order
			'sticky': Mongo.NumberInt(0),
			//NOTE: these are numbers because we XOR them for toggling in action handler
			'locked': Mongo.NumberInt(0),
			'bumplocked': Mongo.NumberInt(0),
			'cyclic': Mongo.NumberInt(0),
			'salt': salt,
			'selfmod': selfmod ? Mongo.NumberInt(1) : Mongo.NumberInt(0),
		});
	}

	let threadPage = null;
	if (data.thread) {
		threadPage = await Posts.getThreadPage(req.params.board, data.thread);
	}

	const { postId, postMongoId } = await Posts.insertOne(res.locals.board, data, thread, res.locals.anonymizer);

	let enableCaptcha = false; //make this returned from some function, refactor and move the next section to another file
	const tphTriggerActive = (tphTriggerAction > 0 && tphTrigger > 0);
	if (pphTriggerAction || tphTriggerActive) { //if a trigger is enabled
		const triggerUpdate = {
			'$set': {},
		};
		//and a setting needs to be updated
		const pphTriggerUpdate = (pphTriggerAction < 3 && captchaMode < pphTriggerAction)
			|| (pphTriggerAction === 3 && lockMode < 1)
			|| (pphTriggerAction === 4 && lockMode < 2);
		const tphTriggerUpdate = (tphTriggerAction < 3 && captchaMode < tphTriggerAction)
			|| (tphTriggerAction === 3 && lockMode < 1)
			|| (tphTriggerAction === 4 && lockMode < 2);
		if (tphTriggerUpdate || pphTriggerUpdate) {
			const hourPosts = await Stats.getHourPosts(res.locals.board._id);
			const calcTriggerMode = (update, trigger, triggerAction, stat) => { //todo: move this somewhere else
				if (trigger > 0 && stat >= trigger) {
					//update in memory for other stuff done e.g. rebuilds
					if (triggerAction < 3) {
						res.locals.board.settings.captchaMode = triggerAction;
						update['$set']['settings.captchaMode'] = triggerAction;
						enableCaptcha = true; //todo make this also returned after moving/refactoring this
					} else {
						res.locals.board.settings.lockMode = triggerAction - 2;
						update['$set']['settings.lockMode'] = triggerAction - 2;
					}
					return true;
				}
				return false;
			};
			const updatedPphTrigger = pphTriggerUpdate && calcTriggerMode(triggerUpdate, pphTrigger, pphTriggerAction, hourPosts.pph);
			const updatedTphTrigger = tphTriggerUpdate && calcTriggerMode(triggerUpdate, tphTrigger, tphTriggerAction, hourPosts.tph);
			if (updatedPphTrigger || updatedTphTrigger) {
				//set it in the db
				await Boards.updateOne(res.locals.board._id, triggerUpdate);
				await cache.sadd('triggered', res.locals.board._id);
			}
		}
	}

	//for cyclic threads, delete posts beyond bump limit
	if (thread && thread.cyclic && thread.replyposts >= replyLimit) {
		const cyclicOverflowPosts = await Posts.db.find({
			'thread': data.thread,
			'board': req.params.board
		}).sort({
			'postId': -1,
		}).skip(replyLimit).toArray();
		if (cyclicOverflowPosts.length > 0) {
			await deletePosts(cyclicOverflowPosts, req.params.board, res.locals);
			const fileCount = cyclicOverflowPosts.reduce((acc, post) => {
				return acc + (post.files ? post.files.length : 0);
			}, 0);
			//reduce amount counted in post by number of posts deleted
			await Posts.db.updateOne({
				'postId': thread.postId,
				'board': res.locals.board._id
			}, {
				'$inc': { //negative increment
					'replyposts': -cyclicOverflowPosts.length,
					'replyfiles': -fileCount
				}
			});
		}
	}

	const successRedirect = `/${req.params.board}/${req.path.endsWith('/modpost') ? 'manage/' : ''}thread/${req.body.thread || postId}.html#${postId}`;

	const buildOptions = {
		'threadId': data.thread || postId,
		'board': res.locals.board
	};

	//let frontend script know if captcha is still enabled
	res.set('x-captcha-enabled', captchaMode > 0);

	if (req.headers['x-using-live'] != null && data.thread) {
		//defer build and post will come live
		res.json({
			'postId': postId,
			'redirect': successRedirect
		});
		buildQueue.push({
			'task': 'buildThread',
			'options': buildOptions
		});
	} else {
		//build immediately and refresh when built
		await buildThread(buildOptions);
		if (req.headers['x-using-xhr'] != null) {
			res.json({
				'postId': postId,
				'redirect': successRedirect
			});
		} else {
			res.redirect(successRedirect);
		}
	}

	const projectedPost = {
		'_id': postMongoId,
		'u': data.u,
		'date': data.date,
		'name': data.name,
		'country': data.country,
		'board': req.params.board,
		'tripcode': data.tripcode,
		'capcode': data.capcode,
		'subject': data.subject,
		'message': data.message,
		'nomarkup': data.nomarkup,
		'thread': data.thread,
		'postId': postId,
		'sage': data.sage,
		'spoiler': data.spoiler,
		'banmessage': null,
		'userId': data.userId,
		'files': data.files,
		'reports': [],
		'globalreports': [],
		'quotes': data.quotes,
		'backlinks': [],
		'replyposts': 0,
		'replyfiles': 0,
		'sticky': data.sticky,
		'locked': data.locked,
		'bumplocked': data.bumplocked,
		'cyclic': data.cyclic,
		'selfmod': data.selfmod,
		'signature': data.signature,
	};
	if (data.thread) {
		//dont emit thread to this socket, because the room only exists when the thread is open
		Socketio.emitRoom(`${res.locals.board._id}-${data.thread}`, 'newPost', projectedPost);
	}
	const { raw, cloak, type } = data.ip;
	//but emit it to manage pages because they need to get all posts through socket including thread
	Socketio.emitRoom(
		'globalmanage-recent-hashed',
		'newPost',
		{
			...projectedPost,
			ip: { cloak, raw: null, type },
			account: data.account,
			nohide: data.nohide,
			trusted: data.trusted
		});
	Socketio.emitRoom(
		`${res.locals.board._id}-manage-recent-hashed`,
		'newPost',
		{
			...projectedPost, ip: { cloak, raw: null, type },
			account: data.account,
			nohide: data.nohide,
			trusted: data.trusted
		});
	if (!dontStoreRawIps) {
		//no need to emit to these rooms if raw IPs are not stored
		Socketio.emitRoom(
			'globalmanage-recent-raw',
			'newPost',
			{
				...projectedPost,
				ip: { cloak, raw, type },
				account: data.account,
				nohide: data.nohide,
				trusted: data.trusted
			});
		Socketio.emitRoom(
			`${res.locals.board._id}-manage-recent-raw`,
			'newPost',
			{
				...projectedPost,
				ip: { cloak, raw, type },
				account: data.account,
				nohide: data.nohide,
				trusted: data.trusted
			});
	}

	//now add other pages to be built in background
	if (enableCaptcha) {
		if (res.locals.board.settings.captchaMode == 2) {
			//only delete threads if all posts require threads, otherwise just build board pages for thread captcha
			await emptyDir(`${uploadDirectory}/html/${req.params.board}/thread/`); //not deleting json cos it doesnt need to be
		}
		const endPage = Math.ceil(threadLimit / 10);
		buildQueue.push({
			'task': 'buildBoardMultiple',
			'options': {
				'board': res.locals.board,
				'startpage': 1,
				'endpage': endPage
			}
		});
	} else if (data.thread) {
		//refersh pages
		if (sage || thread.bumplocked) {
			//refresh the page that the thread is on
			buildQueue.push({
				'task': 'buildBoard',
				'options': {
					'board': res.locals.board,
					'page': threadPage
				}
			});
		} else {
			//if not saged, it will bump so we should refresh any pages above it as well
			buildQueue.push({
				'task': 'buildBoardMultiple',
				'options': {
					'board': res.locals.board,
					'startpage': 1,
					'endpage': threadPage
				}
			});
		}
	} else if (!data.thread) {
		//new thread, prunes any old threads before rebuilds
		const prunedThreads = await Posts.pruneThreads(res.locals.board);
		if (prunedThreads.length > 0) {
			await deletePosts(prunedThreads, req.params.board, res.locals);
		}
		if (!enableCaptcha) {
			const endPage = Math.ceil(threadLimit / 10);
			buildQueue.push({
				'task': 'buildBoardMultiple',
				'options': {
					'board': res.locals.board,
					'startpage': 1,
					'endpage': endPage
				}
			});
		}
	}

	//always rebuild catalog for post counts and ordering
	buildQueue.push({
		'task': 'buildCatalog',
		'options': {
			'board': res.locals.board,
		}
	});

};
