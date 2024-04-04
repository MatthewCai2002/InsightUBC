var addDatasetForm = document.getElementById('datasetForm');
addDatasetForm.addEventListener('submit', function(event) {
	event.preventDefault(); // Prevent the actual form submission
	let datasetId = event.target[0].value;
	let datasetKind = event.target[1].value;
	let datasetZip = event.target[2].files[0];
	let url = `/dataset/${datasetId}/${datasetKind}`

	fetch(url,{
		method: 'PUT',
		body: datasetZip
	}).then((response) => {
		// THIS IS A STUPID WAY OF GETTING THE ERROR TO PRINT
		// BUT I DON'T KNOW HOW TO DO IT
		console.log(response)
		if (!response.ok) {
			throw new Error(response.status)
		}
		return response.json();
	}).then((response) => {
		alert(`Current Datasets: ${response.result}`)
	}).catch((error) => {
		alert(`fetch error: ${error}`)
	});
});





