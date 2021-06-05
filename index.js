install();

//////////////////////////////
async function install() {
    await load_script("script.min.js");
    await load_css("tools.css");
    console.log("[NST] Extension Loaded");
}

function load_script(file) {
    return new Promise((resolve, reject) => {
        var script = document.createElement("script");
        script.src = chrome.runtime.getURL(file);
        script.onload = function () {
            this.remove();
            resolve();
        };
        (document.head || document.documentElement).appendChild(script);
    });
}

function load_css(file) {
    return new Promise((resolve, reject) => {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL(file);
        link.onload = function () {
            resolve();
        };
        (document.head || document.documentElement).appendChild(link);
    });
}
