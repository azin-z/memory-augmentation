document.addEventListener("DOMContentLoaded", function (event) {
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
			console.log(items);
			var blob = new Blob([JSON.stringify(items)], {type: "text;charset=utf-8"})
			chrome.downloads.download({
				url: URL.createObjectURL(blob),
				filename: 'all-data.txt'
			});
		});

	};
});




