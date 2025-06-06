'use strict';

const greenRegex = /^&gt;((?!&gt;\d+|&gt;&gt;&#x2F;\w+(&#x2F;\d*)?|&gt;&gt;#&#x2F;).*)/gm
	, orangeRegex = /^&lt;(.*)/gm

	// simple
	, italicRegex = /\*(.+?)\*/gm
	, boldRegex = /\*\*(.+?)\*\*/gm
	, underlineRegex = /__(.+?)__/gm
	, strikeRegex = /~~(.+?)~~/gm
	, monoRegex = /&#x60;(.+?)&#x60;/gm
	, spoilerRegex = /\|\|([\s\S]+?)\|\|/gm

	// fancy
	, redRegex = /&#x3D;&#x3D;(.+?)&#x3D;&#x3D;/gm
	, blueRegex = /--(.+?)--/gm
	, glowRegex = /%%(.+?)%%/gm
	, detectedRegex = /\(\(\((.+?)\)\)\)/gm
	, rainbowRegex = /##(.+?)##/gm

	/* eslint-disable no-useless-escape */
	, linkRegex = /(?:[^!])\[(?<label>[^\[][^\]]*?)\]\((?<url>(?:&#x2F;[^\s<>\[\]{}|\\^)]+|https?\:&#x2F;&#x2F;[^\s<>\[\]{}|\\^)]+|mailto:[\w.@]+))\)|(?<urlOnly>(?:(?<!='))https?\:&#x2F;&#x2F;[^\s<>\[\]{}|\\^]+)/g
	, imageRegex = /!\[(?<alt>[^\]]*)\]\((?<url>(?:&#x2F;[^\s<>\[\]{}|\\^]+|https?\:&#x2F;&#x2F;[^\s<>\[\]{}|\\^]+))\)/g
	, codeRegex = /(?:(?<language>[a-z+]{1,14})\r?\n)?(?<code>[\s\S]+)/i
	, includeSplitRegex = /(\[code\][\s\S]+?\[\/code\])/gm
	, splitRegex = /\[code\]([\s\S]+?)\[\/code\]/gm
	, trimNewlineRegex = /^(\s*\r?\n)*/g
	, simpleEscape = require(__dirname + '/escape.js')
	, { highlight, highlightAuto, listLanguages } = require('highlight.js')
	, validLanguages = listLanguages() //precompute
	, { addCallback } = require(__dirname + '/../../redis/redis.js')
	, config = require(__dirname + '/../../misc/config.js')
	, diceroll = require(__dirname + '/handler/diceroll.js')
	, fortune = require(__dirname + '/handler/fortune.js')
	, linkmatch = require(__dirname + '/handler/linkmatch.js')
	, { Permissions } = require(__dirname + '/../../permission/permissions.js');

let replacements = [];

const updateMarkdownPerms = () => {
	replacements = [
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: greenRegex, cb: (permissions, match, green) => `<span class='greentext'>&gt;${green}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: orangeRegex, cb: (permissions, match, orange) => `<span class='orangetext'>&lt;${orange}</span>` },

		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: boldRegex, cb: (permissions, match, bold) => `<span class='bold'>${bold}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: italicRegex, cb: (permissions, match, italic) => `<span class='em'>${italic}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: underlineRegex, cb: (permissions, match, underline) => `<span class='underline'>${underline}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: strikeRegex, cb: (permissions, match, strike) => `<span class='strike'>${strike}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: monoRegex, cb: (permissions, match, mono) => `<span class='mono'>${mono}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: spoilerRegex, cb: (permissions, match, spoiler) => `<span class='spoiler'>${spoiler}</span>` },

		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: redRegex, cb: (permissions, match, red) => `<span class='title'>${red}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: blueRegex, cb: (permissions, match, blue) => `<span class='bluetext'>${blue}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: glowRegex, cb: (permissions, match, glow) => `<span class='glowtext'>${glow}</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: detectedRegex, cb: (permissions, match, detected) => `<span class='detected'>&lpar;&lpar;&lpar; ${detected} &rpar;&rpar;&rpar;</span>` },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: rainbowRegex, cb: (permissions, match, rainbow) => `<span class='rainbow'>${rainbow}</span>` },

		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: linkRegex, cb: linkmatch },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: diceroll.regexMarkdown, cb: diceroll.markdown },
		{ permission: Permissions.USE_MARKDOWN_GENERAL, regex: fortune.regex, cb: fortune.markdown },
		{ permission: Permissions.USE_MARKDOWN_IMAGE, regex: imageRegex, cb: (permissions, match, altText, imageSrc) => `<img class='embimg' title='${altText}' alt='${altText}' src='${imageSrc}' />` },
	];
};

updateMarkdownPerms();
addCallback('config', updateMarkdownPerms);

module.exports = {

	prepareMarkdown: (text, force) => {
		if (!text || text.length === 0) {
			return text;
		}
		const chunks = text.split(includeSplitRegex);
		for (let i = 0; i < chunks.length; i++) {
			//every other chunk will be a code block
			if (i % 2 === 0) {
				chunks[i] = chunks[i].replace(
					diceroll.regexPrepare, diceroll.prepare.bind(null, force));
			}
		}
		return chunks.join('');
	},

	markdown: (text, permissions) => {
		const chunks = text.split(splitRegex);
		const { highlightOptions } = config.get;
		for (let i = 0; i < chunks.length; i++) {
			//every other chunk will be a code block
			if (i % 2 === 0) {
				const escaped = simpleEscape(chunks[i]);
				const newlineFix = escaped.replace(/^\r?\n/, ''); //fix ending newline because of codeblock
				chunks[i] = module.exports.processRegularChunk(newlineFix, permissions);
			} else if (permissions.get(Permissions.USE_MARKDOWN_GENERAL)) {
				chunks[i] = module.exports.processCodeChunk(chunks[i], highlightOptions);
			}
		}
		return chunks.join('');
	},

	processCodeChunk: (text, highlightOptions) => {
		const matches = text.match(codeRegex);
		const trimFix = matches.groups.code.replace(trimNewlineRegex, '');
		let lang;
		if (matches.groups.language && matches.groups.language.length > 0) {
			lang = matches.groups.language.toLowerCase();
		}
		if (!lang) {
			//no language specified, try automatic syntax highlighting
			const { relevance, value } = highlightAuto(trimFix, highlightOptions.languageSubset);
			if (relevance > highlightOptions.threshold) {
				return `<span class='code hljs'>${value}</span>`;
			}
		} else if (lang === 'aa') {
			return `<span class='aa'>${simpleEscape(matches.groups.code)}</span>`;
		} else if (validLanguages.includes(lang)) {
			const { value } = highlight(trimFix, { language: lang, ignoreIllegals: true });
			return `<span class='code hljs'>${value}</span>`;
		}
		//else, auto highlight relevance threshold was too low, lang was not a valid language, or lang was 'plain'
		return `<span class='code'>${simpleEscape(trimFix)}</span>`;
	},

	processRegularChunk: (text, permissions) => {
		//filter replacements based on their permissions
		const allowedReplacements = replacements.filter(r => permissions.get(r.permission));
		for (let i = 0; i < allowedReplacements.length; i++) {
			//could bind more variables here and make them available as additional arguments. would pass more args -> markdown -> procesRegularChunk, etc.
			text = text.replace(allowedReplacements[i].regex, allowedReplacements[i].cb.bind(null, permissions));
		}
		return text;
	},

};
