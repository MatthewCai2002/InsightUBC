document.getElementById('datasetForm').addEventListener('submit', async function(e) {
	e.preventDefault();

	const datasetId = document.getElementById('datasetId').value;
	const datasetFile = document.getElementById('datasetFile').files[0];
	const feedbackElement = document.getElementById('feedback');

	if (!datasetId || !datasetFile) {
		feedbackElement.textContent = 'Please enter a dataset ID and select a file.';
		return;
	}

	const formData = new FormData();
	formData.append('dataset', datasetFile);

	try {
		const response = await fetch(`/dataset/${encodeURIComponent(datasetId)}/sections`, {
			method: 'PUT',
			body: formData,
		});

		const result = await response.json();

		if (response.ok) {
			feedbackElement.textContent = 'Dataset added successfully.';
		} else {
			feedbackElement.textContent = `Error: ${result.error}`;
		}
	} catch (error) {
		console.error('Failed to upload dataset:', error);
		feedbackElement.textContent = 'Failed to upload dataset.';
	}
});
