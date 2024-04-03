function initMap() {
	var map = new google.maps.Map(document.getElementById('map'), {
		zoom: 15,
		center: {lat: -34.397, lng: 150.644} // Example center point
	});
	// Example: Place a marker for a building
	var marker = new google.maps.Marker({
		position: {lat: -34.397, lng: 150.644},
		map: map,
		title: 'Building Name'
	});
	// Add more markers based on building location
}
document.getElementById("click-me-button").addEventListener("click", function() {
	alert("Button Clicked!");
});
