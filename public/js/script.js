document.addEventListener("DOMContentLoaded", function () {
    const notificationBell = document.getElementById("notification-bell");
    const notificationPopup = document.getElementById("notification-popup");
    const closePopup = document.querySelector(".close-popup");
    const clearButton = document.getElementById("clear-notifications");
    const notificationList = document.getElementById("notification-list");
    const noNotifications = document.getElementById("no-notifications");

    // Show popup when notification bell is clicked
    notificationBell.addEventListener("click", function () {
        notificationPopup.style.display = notificationPopup.style.display === "block" ? "none" : "block";
    });

    // Close popup when close button is clicked
    closePopup.addEventListener("click", function () {
        notificationPopup.style.display = "none";
    });

    // Hide popup when clicking outside of it
    document.addEventListener("click", function (event) {
        if (!notificationPopup.contains(event.target) && event.target !== notificationBell) {
            notificationPopup.style.display = "none";
        }
    });

    // Clear notifications when button is clicked
    if (clearButton) {
        clearButton.addEventListener("click", function () {
            fetch("/clear-notifications", { method: "POST" })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        notificationList.innerHTML = '<li id="no-notifications">No new notifications</li>';
                        clearButton.style.display = "none"; // Hide the button
                        document.querySelector(".notification-badge").style.display = "none"; // Hide badge
                    }
                })
                .catch(error => console.error("Error:", error));
        });
    }
});
