function openApp(url) {
  window.open(url, "_blank");
}

function updateTime() {
  const now = new Date();
  document.getElementById("time").innerText =
    now.getHours() + ":" + now.getMinutes().toString().padStart(2, "0");
}

setInterval(updateTime, 1000);
updateTime();