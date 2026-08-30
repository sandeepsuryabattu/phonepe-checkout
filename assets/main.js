document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  document.querySelectorAll(".primary-nav a").forEach(function (link) {
    link.addEventListener("click", function () {
      document.body.classList.remove("nav-open");
    });
  });
});
