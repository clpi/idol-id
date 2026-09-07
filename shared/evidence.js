(function () {
  "use strict";
  var identity = document.getElementById("identity");
  if (!identity) return;
  fetch("/__idol/version")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (data) {
      var pre = document.createElement("pre");
      pre.textContent = JSON.stringify(data, null, 2);
      identity.appendChild(pre);
    })
    .catch(function () {
      var p = document.createElement("p");
      p.textContent = "identity unavailable";
      identity.appendChild(p);
    });
})();
