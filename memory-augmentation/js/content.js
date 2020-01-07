const urlKeySeparator = '#*#*#';
const url = getTabURL();
var idCounter = 0;
var port = chrome.runtime.connect({name: 'currInViewChat'});
var firstLoad = true;
var pageElementStatus = [];
var pageElements = [];

window.onload = function(e){
	pageElements = document.body.getElementsByTagName("*");
	window.addEventListener('scroll',function(){
	if(!firstLoad)
		onVisibilityChange(false);
	});
	onVisibilityChange(true);
	firstLoad = false;
	port.onMessage.addListener(function (msg) {
	if (msg.active) {
		onVisibilityChange(true); // when tab is again in focus, all items that are in view need to be updated
	}
	});
}


function isElementPartiallyInViewport(el) {
	if (typeof jQuery !== 'undefined' && el instanceof jQuery) el = el[0];

	var rect = el.getBoundingClientRect();
	// DOMRect { x: 8, y: 8, width: 100, height: 100, top: 8, right: 108, bottom: 108, left: 8 }
	var windowHeight = (window.innerHeight || document.documentElement.clientHeight);
	var windowWidth = (window.innerWidth || document.documentElement.clientWidth);

	var vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
	var horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);

	return (vertInView && horInView);
}

function onVisibilityChange(resumedFocus = false) {
	if(resumedFocus){ //first time write whole document to storage.
		writeElementToStorage(document.body, true)
	}
	for (var i = 0, max = pageElements.length; i < max; i++) {
		var isInView = isElementPartiallyInViewport(pageElements[i]);
		if ((!pageElementStatus[i] && isInView) || (pageElementStatus[i] && !isInView) ||
			(resumedFocus && isInView)) {
			writeElementToStorage(pageElements[i], isInView);
		}
		pageElementStatus[i] = isInView;
	}
}

function getTabURL() {
	return document.location.href;
}

function addToCurrInView(key) {
	port.postMessage({type: 'add', key: url + urlKeySeparator + key});
}

function removeFromCurrInView(key) {
	port.postMessage({type: 'delete', key: url + urlKeySeparator + key});
}


function writeNewItemToStorage(key, newItem) {
	addToCurrInView(key);
	var result = {};
	result[url + urlKeySeparator + key] = newItem;
	chrome.storage.local.set(result, function () {
		console.log(result, ' saved to storage!');
	});
}

function updateExistingItemsTS(key, isInView) {
	var ts = getCurrTime();
	chrome.storage.local.get([url + urlKeySeparator + key], function (item) {
		if (!item || !item[url + urlKeySeparator + key])
			return;
		var tsArray = item[url + urlKeySeparator + key].timestamps;
		if (isInView) {
			addToCurrInView(key);
			tsArray = tsArray.concat({start: ts});
		} else {
			removeFromCurrInView(key);
			tsArray[tsArray.length - 1].end = ts;
		}
		item[url + urlKeySeparator + key].timestamps = tsArray;
		var result = {};
		result[url + urlKeySeparator + key] = item[url + urlKeySeparator + key];
		chrome.storage.local.set(result, function () {
			console.log(result[url + urlKeySeparator + key], 'updated in storage');
		});
	});
}



function elementTextIsEmpty(text) {
	if (!text.replace(/\s/g, "").length) { // item is empty don't write it
		console.log("item length is 0");
		return true;
	}
	return false;
}

function itemIsTooBig(newItem) { // solved by getting unlimitedStorage permission
	if (((newItem.data.length + newItem.url.length * 2 + // lets hope this calculates length of the new item!
		newItem.timestamps[0].start.length * 2 + 5) * 2) > 5242880) { // item is bigger than QUOTA_BYTES
		return true;
	}
	return false;
}

function writeElementToStorage(el, isInView) {
	var tagName = el.tagName.toLowerCase();
	var isScript = (tagName === "script");
	var isStyle = (tagName === "style");
	var isEmbed = (tagName === "embed");
	if (isScript || isStyle)
		return;

	var ts = getCurrTime();
	var url = getTabURL();
	var elementID = el.getAttribute('m-id');
	if (elementID) {
		updateExistingItemsTS(elementID, isInView);
		return
	}
	var newText = el.textContent;

	if (!elementID && isInView && (!elementTextIsEmpty(newText) || isEmbed)) { //write elem start time to storage add id on element
		elementID = generateUID();
		el.setAttribute('m-id', elementID);
		var newItem = {
			timestamps: [{start: ts}],
			data: newText,
			url: url,
			tag: tagName,
			selectionWeight: 0,
			copyWeight: 0,
			type: 'in_view'
		};
		if (itemIsTooBig(newItem)) {
			console.log("item is big");
		}
		writeNewItemToStorage(elementID, newItem);
	}

}
