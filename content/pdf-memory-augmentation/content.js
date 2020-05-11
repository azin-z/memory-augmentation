
var idCounter = 0;
const url = getTabURL();
const urlKeySeparator = '#*#*#';
var observers = [];
var firstLoad = true;
var pageElements = {};
var alreadyProcessedPages
var port = null;

document.addEventListener("DOMContentLoaded", function(event) {
  main()
});

function addOnScrollIfViewerAvailable(){
  var viewerContainer = document.getElementById("viewerContainer");

  if(!viewerContainer) {
      window.setTimeout(addOnScrollIfViewerAvailable,500);
      return;
  }
  viewerContainer.addEventListener("scroll", function() {
    trackSpansIfAvailable();
  });
}

function main() {
  port = chrome.runtime.connect({name: 'currInViewChat'});
  trackSpansIfAvailable();
  addOnScrollIfViewerAvailable();

	port.onMessage.addListener(function (msg) {
		if (msg.active) {
			onVisibilityChange(true);
		}
	});
}

function onVisibilityChange(resumedFocus = false) {
  var pageElementsArray = Object.values(pageElements);
  for (pageElement of pageElementsArray) {
		var isInView = isElementPartiallyInViewport(pageElement.node);
		if ((!pageElement.status && isInView) || (pageElement.status && !isInView) ||
			(resumedFocus && isInView)) {
			writeElementToStorage(pageElement.node, isInView);
		}
		pageElement.status = isInView;
	}
}


function getCurrTime() {
	var d = new Date(Date.now());
	return d.toString();
}

function addSpansToPageElements(textLayer) {
  textLayer.setAttribute("data-page-number", getTextLayerIdentifier(textLayer));
  for(span of textLayer.getElementsByTagName("SPAN")){
    if(span.getAttribute("m-id")){
      continue;
    }
    var spanPageNumber = getSpanPageNumber(span);
    var spanIndexInParent = getSpanIndexInParent(span);
    pageElements[spanPageNumber + '-' + spanIndexInParent] = {'node': span, status: false};
  }
}


function trackSpansIfAvailable() {
  var pages = document.getElementById("viewer").getElementsByClassName("page");
  if(!pages.length) {
      window.setTimeout(trackSpansIfAvailable,500);
      return;
  }
  for(page of pages) {
    var textLayer = page.getElementsByClassName("textLayer")[0];
    if(!textLayer){
      continue;
    }
    if(textLayer.getAttribute("data-page-number")){
      continue;
    }
    if (!textLayer.getElementsByClassName("endOfContent")[0]) {
      window.setTimeout(trackSpansIfAvailable, 500);
      return;
    }
    addSpansToPageElements(textLayer);
    pageElements[textLayer.getAttribute("data-page-number")] = {'node': textLayer, status: false};
  }
  onVisibilityChange();
}

function getSpanIndexInParent(span) {
  return Array.prototype.indexOf.call(span.parentNode.childNodes, span);
}

function getSpanPageNumber(span){
  return span.parentNode.getAttribute("data-page-number");
}

function getTextLayerIdentifier(textLayer) {
  return textLayer.parentNode.getAttribute("data-page-number");
}


function generateUID() {
	var idstr = String.fromCharCode(Math.floor((Math.random() * 25) + 65));
	do {
		// between numbers and characters (48 is 0 and 90 is Z (42-48 = 90)
		var ascicode = Math.floor((Math.random() * 42) + 48);
		if (ascicode < 58 || ascicode > 64) {
			// exclude all chars between : (58) and @ (64)
			idstr += String.fromCharCode(ascicode);
		}
	} while (idstr.length < 4);
	idstr += idCounter.toString();
	return (idstr);
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
		// console.log(result, ' saved to storage!');
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
			// console.log(result[url + urlKeySeparator + key], 'updated in storage');
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

function itemIsTooBig(newItem) {
	if (((newItem.data.length + newItem.url.length * 2 +
		newItem.timestamps[0].start.length * 2 + 5) * 2) > 5242880) {
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
	var elementID = el.getAttribute("m-id");
	if (elementID) {
		updateExistingItemsTS(elementID, isInView);
		return
	}
	var newText = el.textContent;

	if (!elementID && isInView && (!elementTextIsEmpty(newText) || isEmbed)) { //write elem start time to storage add id on element
		elementID = generateUID();
		el.setAttribute("m-id", elementID);
		var newItem = {
			timestamps: [{start: ts}],
			data: newText,
			url: url,
			tag: tagName,
			selectionWeight: 0,
			copyWeight: 0,
			type: 'in_view',
      pageNumber: getSpanPageNumber(el),
      spanIndexInPage: (tagName === "span") ? getSpanIndexInParent(el): ""
		};
		if (itemIsTooBig(newItem)) {
			console.log("item is big");
		}
		writeNewItemToStorage(elementID, newItem);
	}

}
