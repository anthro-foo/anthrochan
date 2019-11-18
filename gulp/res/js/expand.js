!localStorage.getItem('volume') ? localStorage.setItem('volume', 100) : void 0;

window.addEventListener('DOMContentLoaded', (event) => {

	const isCatalog = window.location.pathname.endsWith('catalog.html');

	if (!isCatalog) {
		const thumbs = document.getElementsByClassName('post-file-src');

		const volumeSetting = document.getElementById('volume-setting');
		let volumeLevel = localStorage.getItem('volume');
		const changeVolume = (change, changeFromConflict) => {
			volumeLevel = volumeSetting.value;
			console.log('adjusting volume', volumeLevel);
			localStorage.setItem('volume', volumeLevel);
		}
		volumeSetting.value = volumeLevel;
		volumeSetting.addEventListener('change', changeVolume, false);

		const toggle = function(thumb, exp, fn) {
			const close = exp.previousSibling.innerText === 'Close' ? exp.previousSibling : null;
			if (thumb.style.display === 'none') {
				thumb.style.display = '';
				exp.style.display = 'none';
				fn.style.maxWidth = '';
				if (close) {
					close.style.display = 'none';
					exp.pause();
				}
			} else {
				thumb.style.display = 'none';
				exp.style.display = '';
				fn.style.maxWidth = exp.offsetWidth+'px';
				if (close) {
					close.style.display = '';
					exp.play();
				}
			}
		}

		const expand = function(e) {
			e.preventDefault();
			const fileLink = this.firstChild;
			const fileSrc = fileLink.href;
			const type = this.dataset.type;
			const thumbElement = fileLink.firstChild;
			const fileName = this.previousSibling;
			const next = thumbElement.nextSibling;
			let expandedElement;
			if (next) {
				if (next.innerText === 'Close') {
					expandedElement = next.nextSibling;
				} else {
					expandedElement = next;
				}
			}
			if (!expandedElement && thumbElement.style.opacity !== '0.5') {
				let source;
				switch(type) {
					case 'image':
						fileLink.style.minWidth = fileLink.offsetWidth+'px';
						fileLink.style.minHeight = fileLink.offsetHeight+'px';
						thumbElement.style.opacity = '0.5';
						thumbElement.style.cursor = 'wait'
						expandedElement = document.createElement('img');
						source = expandedElement;
						source.onload = function() {
							thumbElement.style.opacity = '';
							thumbElement.style.cursor = '';
							fileLink.appendChild(expandedElement);
							toggle(thumbElement, expandedElement, fileName);
						}
						break;
					case 'video':
						fileLink.style.minWidth = fileLink.offsetWidth+'px';
						fileLink.style.minHeight = fileLink.offsetHeight+'px';
					case 'audio':
						expandedElement = document.createElement(type);
						close = document.createElement('div');
						close.innerText = 'Close';
						close.addEventListener('click', function(e) {
							e.preventDefault();
							e.stopPropagation();
							toggle(thumbElement, expandedElement, fileName);
						}, true);
						expandedElement.controls = 'true';
						expandedElement.volume = volumeLevel/100;
						source = document.createElement('source');
						expandedElement.appendChild(source);
						fileLink.appendChild(expandedElement);
						fileLink.insertBefore(close, expandedElement);
						toggle(thumbElement, expandedElement, fileName);
						break;
					deault:
						break; //uh oh
				}
				source.src = fileSrc;
			} else if (expandedElement) {
				toggle(thumbElement, expandedElement, fileName);
			}
			return false;
		};

		for (let i = 0; i < thumbs.length; i++) {
			thumbs[i].addEventListener('click', expand, false);
		}

		window.addEventListener('addPost', function(e) {
			const post = e.detail.post;
			const newthumbs = post.getElementsByClassName('post-file-src');
			for (let i = 0; i < newthumbs.length; i++) {
				newthumbs[i].addEventListener('click', expand, false);
			}
		});
	}

});
