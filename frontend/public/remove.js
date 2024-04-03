document.getElementById("removeDatasetButton").addEventListener("click", function() {
	const datasetId = document.getElementById("datasetIdToRemove").value;

	fetch(`/dataset/${datasetId}`, { method: "DELETE" })
		.then(response => {
			if (response.ok) {
				return response.json();
			}
			throw new Error('Failed to remove dataset');
		})
		.then(data => {
			alert(`Dataset removed successfully: ${data.result}`);
			// Update UI to reflect the dataset has been removed
		})
		.catch(error => alert(error.message));
});
