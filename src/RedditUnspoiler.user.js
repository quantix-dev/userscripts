// ==UserScript==
// @name        Spectacles
// @namespace   Violentmonkey Scripts
// @match       https://www.reddit.com/*
// @run-at		document-idle
// @grant       none
// @version     1.2
// @author      Quantix
// @description Glasses to remove the blurry spoilers
// ==/UserScript==

// Globals
let treeWalker;

// Searches the external post for an unblurred match, and ensures it's the same image.
function getUnspoileredSrc(blurredSrc, link) {
	return new Promise((resolve, reject) => {
		// Checking to see if the link isn't already unblurred
		const splitURL = link.split('?')[1]
		const urlParams = new URLSearchParams(splitURL);
		if (link.split('/')[2] == 'preview.redd.it' && !urlParams.has('blur')) {
			resolve(link);
		}

		// Getting source from external page
		const request = new window.XMLHttpRequest();
		request.open('GET', link);
		request.responseType = 'document';
		request.onload = () => {
			if (request.readyState !== request.DONE && request.status !== 200) return;

			// Creating temporary tree walker
			const page = request.response;
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
					if (child.src == blurredSrc) {
						resolve(curNode.href);
						return;
					}
				}
			}

			// Something up
			reject(blurredSrc);
		}

		// Sending request
		request.send();
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
				const video = document.createElement("video");
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
				treeWalker.currentNode = video; // Fix for treeWalker freezing on deleted div

				// Fixing styling
				video.parentNode.style = "";

				break;
			}
			default: {
				element.src = src;
				element.style.filter = 'blur(0px)';
				break;
			}
		}
	});
}

// Scans through all of the page's posts and attempts to unspoiler
let cooldown = false;
function scanContent() {
	if (cooldown) return;
	cooldown = true;

	// Loop through the nodes
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

	setTimeout(() => cooldown = false, 500);
}

// Initialises and sets up post unspoilerinator
(() => {
	'use strict';

	// Getting the root node
	let rootNode;
	if (window.location.href.split('/')[5] !== 'comments') {
		let depth = 0;
		rootNode = document.getElementsByClassName('scrollerItem Post')[0].parentNode.parentNode.parentNode;
		while (rootNode.childNodes.length <= 5 && depth < 10) {
			rootNode = rootNode.parentNode;
			depth++;
		}

	} else {
		rootNode = document.getElementsByClassName('Post')[0].parentNode;
	}

	// Create tree walker
	treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, function (node) {
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

	// Setup content scanner
	scanContent()
	new MutationObserver(scanContent).observe(rootNode, { childList: true });	// old method: window.addEventListener('scroll', scan)
})();