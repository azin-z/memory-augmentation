document.addEventListener("DOMContentLoaded", function (event) {
	console.log("pop log");

	document.getElementById("switch-input").addEventListener('change', (event) => {
		chrome.management.getSelf((extInfo) => {
			if (document.querySelector('#switch-input:checked')) {
				chrome.management.setEnabled(extInfo.id, true, () => {
					console.log("enabled");
				});
			}
			if(!document.querySelector('#switch-input:checked')){
				chrome.management.setEnabled(extInfo.id, false, () => {
					console.log("disabled")
				});
			}
		})
	});
	var resultsButton = document.getElementById("getResults");
	resultsButton.onclick = () => {
		chrome.storage.local.get(null, function (items) {
			var blob = new Blob([JSON.stringify(items)], {type: "text;charset=utf-8"})
			var date = Math.round(Date.now()/1000);
			var name = "m-dump-" + date + ".txt";
			console.log(name);
			chrome.downloads.download({
				url: URL.createObjectURL(blob),
				filename: name
			});
		});
	};
	//flushDB
	var flushDBButton = document.getElementById("flushDB");
	flushDBButton.onclick = () => {
		chrome.storage.local.clear(function () {
			var error = chrome.runtime.lastError;
    	if (error)
        console.error(error);
		});
	};
});
