document.addEventListener("DOMContentLoaded", function () {
    const notificationBell = document.getElementById("notification-bell");
    const notificationPopup = document.getElementById("notification-popup");
    const closePopup = document.querySelector(".close-popup");

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
});
