document.addEventListener('mouseup', handleSelection);

document.addEventListener(
	"copy",
	(e) => {
		handleSelection(e, true);
	}
);

function handleSelection(e, copy=false) {
	var sel = window.getSelection();
	var selText = sel.toString();
	if (elementTextIsEmpty(selText))
		return;
	var sel_node;
	for (sel_node of getSelectedNodes()){
		updateExistingItemsSelWeight(sel_node.parentNode, copy)
	}
	// writeSelectionTextToStorage(selText);
}

function updateExistingItemsSelWeight(el, copy) {
	var feature_name = "selectionWeight";
	if(copy)
		feature_name = "copyWeight";

	var elementID = el.getAttribute('m-id');
	if (!elementID)
		return;
	chrome.storage.local.get([url + urlKeySeparator + elementID], function (item) {
		if (!item || !item[url + urlKeySeparator + elementID])
			return;
		item[url + urlKeySeparator + elementID][feature_name] += 1;
		var result = {};
		result[url + urlKeySeparator + elementID] = item[url + urlKeySeparator + elementID];
		chrome.storage.local.set(result, function () {
			// console.log(result[url + urlKeySeparator + elementID], 'updated in storage');
		});
	});
}

function writeSelectionTextToStorage(text) {
	var ts = getCurrTime();
	var newItem = {timestamps: ts, data: text, url: url, type: 'selection'};
	writeNewItemToStorage(generateUID(), newItem);
}

function nextNode(node) {
	if (node.hasChildNodes()) {
		return node.firstChild;
	} else {
		while (node && !node.nextSibling) {
			node = node.parentNode;
		}
		if (!node) {
			return null;
		}
		return node.nextSibling;
	}
}

function getRangeSelectedNodes(range) {
	var node = range.startContainer;
	var endNode = range.endContainer;

	// Special case for a range that is contained within a single node
	if (node == endNode) {
		return [node];
	}

	// Iterate nodes until we hit the end container
	var rangeNodes = [];
	while (node && node != endNode) {
		rangeNodes.push( node = nextNode(node) );
	}

	// Add partially selected nodes at the start of the range
	node = range.startContainer;
	while (node && node != range.commonAncestorContainer) {
		rangeNodes.unshift(node);
		node = node.parentNode;
	}

	return rangeNodes;
}

function getSelectedNodes() {
	if (window.getSelection) {
		var sel = window.getSelection();
		if (!sel.isCollapsed) {
			return getRangeSelectedNodes(sel.getRangeAt(0));
		}
	}
	return [];
}
