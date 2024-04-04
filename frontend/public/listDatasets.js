
var listDiv = document.getElementById('datasets');
var removeDatasetForm = document.getElementById('removeForm');
var addDatasetForm = document.getElementById('datasetForm');

function getDatasets(response) {
	console.log(response.result)
	var ul = document.getElementById("datasetsList");
	response.result.forEach((dataset) => {
		let li = document.createElement("li");
		li.innerText = dataset.id;
		ul.append(li)
	})
}

document.addEventListener('DOMContentLoaded', function(event) {
	console.log("MADE IT HERE")
	fetch('/datasets').then((response) => {
		// THIS IS A STUPID WAY OF GETTING THE ERROR TO PRINT
		// BUT I DON'T KNOW HOW TO DO IT
		if (!response.ok) {
			throw new Error(response.status)
		}
		return response.json();
	}).then((response) => {
		getDatasets(response)
	}).catch((error) => {
		alert(`fetch error: ${error}`)
	});
})



removeDatasetForm.addEventListener('submit', function(event) {
	event.preventDefault(); // Prevent the actual form submission
	fetch('/datasets').then((response) => {
		// THIS IS A STUPID WAY OF GETTING THE ERROR TO PRINT
		// BUT I DON'T KNOW HOW TO DO IT
		if (!response.ok) {
			throw new Error(response.status)
		}
		return response.json();
	}).then((response) => {
		getDatasets(response);
	}).catch((error) => {
		alert(`fetch error: ${error}`)
	});
});

addDatasetForm.addEventListener('submit', function(event) {
	event.preventDefault(); // Prevent the actual form submission
	fetch('/datasets').then((response) => {
		// THIS IS A STUPID WAY OF GETTING THE ERROR TO PRINT
		// BUT I DON'T KNOW HOW TO DO IT
		if (!response.ok) {
			throw new Error(response.status)
		}
		return response.json();
	}).then((response) => {
		getDatasets(response)
	}).catch((error) => {
		alert(`fetch error: ${error}`)
	});
});
