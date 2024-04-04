var form = document.getElementById('datasetForm');
form.addEventListener('submit', function(event) {
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
		if (!response.ok) {
			return response.json().catch((res) => {
				throw new Error(res)
			})
		}
		return response.json();
	}).then((response) => {
		if (!response.ok) {
			alert(response.error)
			return;
		}
		alert(`Current Datasets: ${response.result}`)
	}).catch((error) => {
		alert(error)
	});
});




