(function () {
  var filters = document.querySelectorAll(".blog-filter");
  var cards = document.querySelectorAll("[data-blog-card]");
  var featuredSection = document.querySelector(".blog-featured-section");
  var empty = document.getElementById("blogEmpty");

  if (!filters.length) return;

  function applyFilter(category) {
    var visibleCount = 0;

    cards.forEach(function (card) {
      var isComing = card.getAttribute("data-coming") === "true";
      var cardCategory = card.getAttribute("data-category") || "";
      var show;

      if (category === "all") {
        show = true;
      } else if (isComing) {
        show = false;
      } else {
        show = cardCategory === category;
      }

      card.classList.toggle("is-hidden", !show);
      if (show) visibleCount += 1;
    });

    if (featuredSection) {
      var featuredVisible = featuredSection.querySelector("[data-blog-card]:not(.is-hidden)");
      featuredSection.classList.toggle("is-collapsed", !featuredVisible);
    }

    if (empty) {
      empty.hidden = visibleCount > 0;
    }
  }

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var category = btn.getAttribute("data-filter") || "all";

      filters.forEach(function (other) {
        var active = other === btn;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", active ? "true" : "false");
      });

      applyFilter(category);
    });
  });
})();
