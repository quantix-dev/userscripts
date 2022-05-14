const mediaLinks = ['preview.redd.it', 'external-preview.redd.it', 'i.redd.it'];
const invalidSourceLinks = [/(reddit.com\/user)/g];

// Single media posts - always have an <a> tag at the top leading to images ource
// Carousel Posts - have an <a> tag, parented to a <figure> tag, that is parenting to a <li> tag and inside the <ul> is all the posts to display

/**
 * A custom 'enum' type that contains all of the possible mediaTypes a post could contain.
 * Helps with fixing the post and adding the unspoilered media back.
 */
const mediaTypes = {
    SINGLE: 0,
    CAROUSEL: 1,
    VIDEO: 2,
    EMBED: 3,
    NONE: -1
}

/**
 * A helper function to create the tree walker necessary to go through posts.
 * @param {*} post 
 * @returns 
 */
function createPostTreeWalker(post) {
    return document.createTreeWalker(
        post,
        NodeFilter.SHOW_ELEMENT,
        function (node) {
            // Validating
            if (node.nodeName === 'IMG') {
                // Constructing URL
                const url = new URL(node.src);

                // Checking to see if it's a valid post
                if (mediaLinks.includes(url.hostname) && url.searchParams.has('blur')) {
                    return NodeFilter.FILTER_ACCEPT;
                }
            }

            return NodeFilter.FILTER_SKIP;
        }
    );
}

/* * * * * */

/**
 * Finds the external source for the post attached
 * @param {Node} mediaNode The media node, often an image, to find the thread to
 * @returns {string} The source.
 */
function findExternalNode(mediaNode) {
    let depth = 0;
    let par = mediaNode;
    while (par && par.classList) {
        if (par.classList.contains('scrollerItem') || par.nodeName == 'A' || depth >= 15) break;
        par = par.parentNode;
        depth++;
    }

    // Handling the gathered node
    if (!par) return null;
    if (par.nodeName == 'A') {
        return par;
    } else {
        // i forgot what this entire section is even for..
        // const treeWalker = document.createTreeWalker(par, NodeFilter.SHOW_ELEMENT, (node) => {
        //     // Validating
        //     if (node.nodeName == 'A') {
        //         if (invalidSourceLinks.filter((link) => node.href.match(link) != null).length <= 0)
        //             return NodeFilter.FILTER_ACCEPT;
        //     }

        //     return NodeFilter.FILTER_SKIP;
        // });


        // while (treeWalker.nextNode()) {
        //     // Prevent duplicate
        //     let flag = true;
        //     const postWalker = createPostTreeWalker(treeWalker.currentNode);
        //     while (postWalker.nextNode()) {
        //         console.log(`node ${postWalker.currentNode} .. ${postWalker.currentNode.src}`)
        //         if (postWalker.currentNode.src == mediaNode.src) {
        //             flag = false;
        //             console.log('found duplicate');
        //             break;
        //         }
        //     }

        //     if (!flag) continue;
        //     return treeWalker.currentNode;
        // }
    }
}

/**
 * Fixes and unblurs media by re-enabling features and hiding the blur effect.
 * @param {Node} mediaNode The image element to fix with the unspoilered source.
 * @param {string} source The url to the unspoilered source of the mediaNode.
 */
const fileTypes = ['png', 'jpeg', 'webp', 'gif', 'mp4']
function removeMediaSpoiler(mediaNode, source) {
    // Extracting fileType
    let fileType = source.split('?')[0].split('.').pop().toLowerCase();
    fileType = !fileTypes.includes(fileType) ? (source.match(/(mediaembed)/g) ? 'embed' : null) : fileType

    // Setting content based on FileType
    switch (fileType) {
        case 'gif':
        case 'mp4': {
            // Creating video
            let video = document.createElement('video');
            video.className = 'media-element';
            video.height = 360;
            video.width = 640;
            video.style =
                'margin: 0px auto; max-height: 700px; display: block; height: 100%; max-width: 100%; position: relative;';
            video.volume = 0;
            video.src = source;
            video.autoplay = true;
            video.loop = true;

            // Parenting
            mediaNode.parentNode.appendChild(video);
            mediaNode.remove();

            // Fixing styling
            mediaNode = video;
            break;
        }

        default: {
            mediaNode.src = source;
            mediaNode.style.filter = 'blur(0px)';
            break;
        }
    }

    // Fix the post
    let linkNode = findExternalNode(mediaNode);
    for (let child of linkNode.children) {
        if (child !== mediaNode && child.nodeName == "DIV") {
            let children = Array.from(child.children);
            children = children.filter((x) => {
                return x.nodeName === "BUTTON" && x.innerHTML.includes('spoiler');
            });

            if (children[0]) {
                children[0].style.display = "none";
            }
        }
    }
}

/**
 * Attempts to search post links to grab the unblurred media source.
 * @param {string} blurredSrc The blurred media source.
 * @param {string} externalSrc The link of the external media source to scan.
 * @returns {string} The unspoilered source link to the media.
 */
function grabSourceFromImage(blurredSrc, externalSrc) {
    return new Promise((resolve, reject) => {
        // Checking to see if the link isn't already unblurred
        const splitURL = externalSrc.split('?')[1];
        const subdomURL = externalSrc.split('/');
        const urlParams = new URLSearchParams(splitURL);
        if (!subdomURL.includes('reddit.com') && !subdomURL.includes('comments') && !urlParams.has('blur')) {
            return resolve(externalSrc);
        }

        // Getting source from external page
        GM_xmlhttpRequest({
            method: 'GET',
            url: externalSrc,
            responseType: 'document',
            onload: (response) => {
                if (response.readyState !== response.DONE && response.status !== 200)
                    return;

                // Creating temporary tree walker
                const page = response.response;
                const pageContent = page.getElementById('AppRouter-main-content');
                const tmpTreeWalker = page.createTreeWalker(
                    pageContent,
                    NodeFilter.SHOW_ELEMENT,
                    (node) => {
                        return node.nodeName == 'A'
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_SKIP;
                    }
                );

                // Looping through to grab source
                let curNode = tmpTreeWalker.currentNode;
                while (curNode) {
                    curNode = tmpTreeWalker.nextNode();

                    // Getting image
                    const children = curNode.childNodes;
                    for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (child.nodeName !== 'IMG') continue;
                        if (child.src == blurredSrc) {
                            return resolve(curNode.href);
                        }
                    }
                }

                // Something up
                return reject(blurredSrc);
            },
        });
    });
}

/**
 * Attempts to get all images from the reddit post.
 * @param {Node} post the post to search for images in.
 * @param {(mediaNode: Node, source: string)} callback the function to call each time an image is found.
 */
function getImagesFromPost(post, callback) {
    // Creating tree walker from post
    const treeWalker = createPostTreeWalker(post);
    let currentNode = treeWalker.currentNode;

    while (currentNode) {
        let source = findExternalNode(treeWalker.currentNode);
        if (source) {
            callback(treeWalker.currentNode, source.href)
        }

        currentNode = treeWalker.nextNode();
    }
}

/**
 * Main function that will remove spoilers from posts, and check against the whitelist or blacklist
 * @param {Node} post The post to remove spoilered media from.
 */
function removePostSpoiler(post, pageType) {
    // Stopping unnecessary posts from continuing
    //if (post.nodeName !== "IMG" && !post.classList.contains('Post')) return;

    // Managing different types
    let postType;
    if (pageType == 'thread') {
        getImagesFromPost(post, removeMediaSpoiler);
        post.click();
    } else {
        getImagesFromPost(post, (mediaNode, source) => {
            grabSourceFromImage(mediaNode.src, source).then((content) => {
                removeMediaSpoiler(mediaNode, content);
            })
        });
    }
}

/* ---------------------- */

// Grabbing the rootNode depending on the post type
let rootNode, postType;
if (window.location.href.split('/')[5] !== 'comments') {
    // Dynamically grabbing for homepage type
    let depth = 0;
    rootNode = document.getElementsByClassName('scrollerItem Post')[0];
    while (rootNode.parentNode !== null && depth < 10) {
        if (rootNode.childNodes.length > 5) break;

        rootNode = rootNode.parentNode;
        depth++;
    }

    // Call initial function on all child nodes
    rootNode.childNodes.forEach((x) => { removePostSpoiler(x, postType) });
} else {
    rootNode = document.getElementsByClassName('Post')[0];
    postType = 'thread';

    // Remove spoiler  on 'root' because this should be the only post
    removePostSpoiler(rootNode)
}

// Setting up a listener to detect when new posts are added
VM.observe(rootNode, (mutList) => {
    mutList.filter((mut) => mut.type === 'childList').map((mut) => mut.addedNodes[0]).forEach((x) => {
        if (!x) return false;
        removePostSpoiler(x, postType)
    });
}, { childList: true });