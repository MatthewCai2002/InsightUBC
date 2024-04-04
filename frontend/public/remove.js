
var removeDatasetForm = document.getElementById('removeForm');
removeDatasetForm.addEventListener('submit', function(event) {
	event.preventDefault(); // Prevent the actual form submission
	let datasetId = event.target[0].value;
	let url = `/dataset/${datasetId}`

	fetch(url, {
		method: 'DELETE'
	}).then((response) => {
		if (!response.ok) {
			throw new Error(response.status)
		}
		return response.json();
	}).then((response) => {
		alert(`Removed Dataset: ${response.result}`)
	}).catch((error) => {
		alert(`fetch error: ${error}`)
	});
});
