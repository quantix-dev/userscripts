// Searches the external post for an unblurred match, and ensures it's the same image.
function getUnspoileredSrc(blurredSrc, link) {
	return new Promise((resolve, reject) => {
		// Checking to see if the link isn't already unblurred
		const splitURL = link.split('?')[1]
		const urlParams = new URLSearchParams(splitURL);
		if (link.split('/')[2] != 'reddit.com' && link.split('/')[2] != 'www.reddit.com' && !urlParams.has('blur')) {
			return resolve(link);
		}

		// Getting source from external page
		GM_xmlhttpRequest({
			method: 'GET',
			url: link,
			responseType: 'document',
			onload: (response) => {
				if (response.readyState !== response.DONE && response.status !== 200) return;

				// Creating temporary tree walker
				const page = response.response
				const pageContent = page.getElementById('AppRouter-main-content');
				const tmpTreeWalker = page.createTreeWalker(pageContent, NodeFilter.SHOW_ELEMENT, (node) => {
					return node.nodeName == 'A' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
				});

				// Looping through to grab source
				let curNode = tmpTreeWalker.currentNode;
				while (curNode) {
					curNode = tmpTreeWalker.nextNode();

					// Check Children
					const children = curNode.childNodes;
					for (let i = 0; i < children.length; i++) {
						const child = children[i];
						if (child.nodeName !== "IMG") continue;
						if (child.src == blurredSrc)
							return resolve(curNode.href);
					}
				}

				// Something up
				return reject(blurredSrc);
			}
		});
	});
}

// Gets the unspoilered content from the post, and plasters it over the thumbnail
function removePostSpoiler(element, postLink) {
	getUnspoileredSrc(element.src, postLink).then(src => {
		const fileType = src.split("?")[0].split(".").pop().toLowerCase();

		// Removing unnecessary children
		for (let child of element.parentNode.childNodes) {
			if (child != element) {
				child.remove();
			}
		}

		// Setting content based on FileType
		switch (fileType) {
			case 'gif':
			case 'mp4': {
				// Creating video
				let video = document.createElement("video");
				video.className = "media-element";
				video.height = 360;
				video.width = 640;
				video.style = "margin: 0px auto; display: block; height: 100%; max-width: 100%; position: relative;";
				video.volume = 0;
				video.src = src;
				video.autoplay = true;
				video.loop = true;

				// Parenting
				element.parentNode.parentNode.appendChild(video);
				element.parentNode.remove();

				// Fixing styling
				video.parentNode.style = "";
				element = video;
				break;
			}
			default: {
				element.src = src;
				element.style.filter = 'blur(0px)';
				break;
			}
		}

		// Ensuring the spoiler button doesn't show up again
		new MutationObserver((list) => list.filter(mut => mut.type === 'childList').forEach((mut) => {
			for (let child of mut.addedNodes) {
				if (child != element) {
					child.remove();
				}
			}
		})).observe(element.parentNode, { childList: true });
	});
}

// Searches through the post and finds the image to unspoiler
function getImageFromPost(post) {
	// Creating tree walker from post
	const treeWalker = document.createTreeWalker(post, NodeFilter.SHOW_ELEMENT, function (node) {
		// Validating
		if (node.nodeName == 'IMG') {
			// Constructing URL
			const url = node.src;
			const splitURL = url.split('?')[1]
			const urlParams = new URLSearchParams(splitURL);

			// Checking to see if it's a valid post
			if (url.split('/')[2] == 'preview.redd.it' && urlParams.has('blur')) {
				return NodeFilter.FILTER_ACCEPT;
			}
		}

		return NodeFilter.FILTER_SKIP;
	});

	let currentNode = treeWalker.currentNode;
	while (currentNode) {
		// Getting next node along
		currentNode = treeWalker.nextNode();
		if (!currentNode) break;

		// Extracting post url from node (better than hardcoding I think..)
		let depth = 0;
		let par = currentNode;
		while (par.nodeName != 'A' && depth < 5) {
			par = par.parentNode;
			depth++;
		}

		// Removing spoiler
		if (par.nodeName != 'A') continue;
		removePostSpoiler(currentNode, par.href);
	}
}

/*===============*/

// Handling different post types
if (window.location.href.split('/')[5] !== 'comments') {
	// Attempting to dynamically grab the root
	let depth = 0;
	let rootNode = document.getElementsByClassName('scrollerItem Post')[0].parentNode.parentNode.parentNode;
	while (rootNode.childNodes.length <= 5 && depth < 10) {
		rootNode = rootNode.parentNode;
		depth++;
	}

	/* Detecting newly added posts, so we can unspoiler them */
	new MutationObserver((mutationList) => mutationList.filter(mut => mut.type === 'childList').forEach((mut) => {
		getImageFromPost(mut.addedNodes[0]);
	})).observe(rootNode, { childList: true });	// old method: window.addEventListener('scroll', scan)

	// Unspoiler already loaded posts
	rootNode.childNodes.forEach(getImageFromPost);
} else {
	getImageFromPost(document.getElementsByClassName('Post')[0]);
}