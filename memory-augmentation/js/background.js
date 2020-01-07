var history = {};
var currInViewPerTab = {};
var activePorts = {};
var currActiveTab = null;
var currActiveWindow = null;

chrome.tabs.onUpdated.addListener(HandleUpdate);
chrome.tabs.onRemoved.addListener(HandleRemove);
chrome.tabs.onReplaced.addListener(HandleReplace);
chrome.tabs.onActivated.addListener(HandleTabActivate);
chrome.windows.onFocusChanged.addListener(HandleWindowFocusChange);
chrome.idle.onStateChanged.addListener(HandleStateChange);
chrome.runtime.onConnect.addListener(HandleNewTabConnection);

// chrome.idle.setDetectionInterval(15); // at least 15
// chrome.management.setEnabled(string id, boolean enabled, function callback)

function HandleStateChange(newState) {
	console.log(newState);
	if (newState === "idle") {
		finalizeTimeStamps(currActiveTab);
		currActiveTab = null;
	}
	if (newState === "active") {
		updateCurrentActiveTab();
	}
}

function HandleWindowFocusChange(windowId) {
	console.log("windowFocusChange", windowId);
	currActiveWindow = windowId;

	finalizeTimeStamps(currActiveTab);

	if (windowId === chrome.windows.WINDOW_ID_NONE) {
		currActiveTab = null;
		return
	}
	updateCurrentActiveTab();

}


function HandleTabActivate(activeInfo) {
	finalizeTimeStamps(currActiveTab);
	currActiveTab = activeInfo.tabId;
	updateCurrentActiveTab();
}


function updateCurrentActiveTab() {
	chrome.tabs.query({active: true, windowType: "normal", lastFocusedWindow: true}, function (tabs) {
		if (!tabs.length) {
			currActiveTab = null;
			return
		}
		if (tabs.length > 1)
			console.error("more than one active tab at a time");
		currActiveTab = tabs[0].id;
		if(activePorts[currActiveTab]){
			activePorts[currActiveTab].postMessage({active: true});
		}
	})
}

function finalizeTimeStamps(tabId) {
	if (!tabId)
		return;
	if (!currInViewPerTab[tabId]) {
		console.log("Tab has nothing in view to finalize");
		return
	}
	console.log("finalizing timestamps of", tabId);
	var ts = getCurrTime();
	console.log(currInViewPerTab[tabId]);
	chrome.storage.local.get(currInViewPerTab[tabId], function (items) {
		console.log(items);
		for (var i = 0; i < Object.keys(items).length; i++) {
			let key = Object.keys(items)[i];
			if (!items || !items[key])
				return;
			var tsArray = items[key].timestamps;
			if (!tsArray[tsArray.length - 1].end)
				tsArray[tsArray.length - 1].end = ts;
			items[key].timestamps = tsArray;
		}
		chrome.storage.local.set(items, function () {
			console.log(items, 'finalized in storage');
		});
	});
}

function HandleUpdate(tabId, changeInfo, tab) {
	var url = changeInfo.url;
	if (tabId in History) {
		if (url == History[tabId][0]) { // just loading ?
			return;
		} else {
			History[tabId].unshift(url);
			console.log('tabUpdated');
			finalizeTimeStamps(tabId)
		}
	} else { // tab is new
		History[tabId] = [];
	}
}

function HandleRemove(tabId, removeInfo) {
	delete History[tabId];
	console.log('tabRemoved');
	finalizeTimeStamps(tabId);
	updateCurrentActiveTab();
}

function HandleReplace(addedTabId, removedTabId) {
	console.log('tabReplaced');
	finalizeTimeStamps(removedTabId);
	updateCurrentActiveTab();
}

function sanitizeInput(input) {
	return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function HandleNewTabConnection(port) {
	activePorts[port.sender.tab.id] = port;
	let tabId = port.sender.tab.id;
	currInViewPerTab[tabId] = [];
	if(port.name !== "currInViewChat"){
		return
	}
	port.onMessage.addListener(function (msg) {
		console.log("receidve msg", msg);
		msg.key = sanitizeInput(msg.key);
		if (msg.type === "add")
			currInViewPerTab[tabId].push(msg.key);
		else if (msg.type === "delete") {
			let index = currInViewPerTab[tabId].indexOf(msg.key);
			currInViewPerTab[tabId].splice(index, 1);
		}
	});
}
