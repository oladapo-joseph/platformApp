// Applies the saved theme before the app loads. "system" (or nothing saved) leaves
// data-theme unset, so tokens.css follows the OS (docs/06 §2, US-6.2).
try {
  var t = localStorage.getItem("el-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
