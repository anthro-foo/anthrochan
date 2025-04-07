window.addEventListener('DOMContentLoaded', async () => {
	let banner = document.getElementsByClassName('board-banner')[0];
	if (banner) {
		banner.addEventListener('click', function () {
			// append some garbage so cache not used
			this.src = `/randombanner?t=${new Date().getTime()}`;
		});
	}

	let container = document.querySelector('.board-ad-container');
	let boardad = document.querySelector('.board-ad');
	let link = boardad?.closest('a');

	if (boardad && link) {
		try {
			let response = await fetch('/randomboardad', { method: 'HEAD', redirect: 'follow' });
			let finalUrl = response.url;

			let url = new URL(finalUrl, window.location.origin);
			let parts = url.pathname.split('/');
			let filename = parts.pop();

			if (!filename.includes('.')) {
				return;
			}

			let base = filename.split('.')[0];
			let idParts = base.split('-');
			if (idParts.length > 1 && /^\d+$/.test(idParts.at(-1))) {
				idParts.pop();
			}
			let id = idParts.join('-');

			container.style.display = '';
			boardad.src = url.pathname;
			link.href = `/${id}/index.html`;
		} catch (err) {
			console.error('Failed to load random board ad:', err);
		}
	}
});