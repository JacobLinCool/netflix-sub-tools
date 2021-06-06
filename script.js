//// Global Variables ////
window.NST_STG = {};
window.NST_MTX = {};
window.NST_DOM = {};
//// Global Variables ////

//// Main Program ////
overwrite_global_functions();
window.addEventListener("load", nst_dom_handler);
//// Main Program ////

//// Date Processing Functions ////
function overwrite_global_functions() {
    ((parse, stringify) => {
        JSON.parse = (text) => {
            let data = parse(text);
            if (data && data.result && data.result.movieId) {
                if (localStorage.getItem("nst-dev-mode")) console.log(data);
                NST_MTX[Number(data.result.movieId)] = process_data(data.result);
                if (location.pathname.split("/").length >= 3 && location.pathname.split("/")[2] == data.result.movieId)
                    NST_STG = NST_MTX[Number(location.pathname.split("/")[2])];
                else if (Object.keys(NST_MTX).length == 1) NST_STG = Object.values(NST_MTX)[0];
            }
            return data;
        };

        JSON.stringify = (data) => {
            if (data && typeof data.url === "string" && data.url.search(new RegExp("manifest|licensedManifest")) > -1) {
                if (localStorage.getItem("nst-dev-mode")) console.log(data);
                for (let v of Object.values(data)) {
                    try {
                        v.profiles.unshift("webvtt-lssdh-ios8");
                        v.showAllSubDubTracks = true;
                    } catch (err) {
                        if (!(err instanceof TypeError)) console.error(`[NST] Error: `, err);
                    }
                }
            }

            return stringify(data);
        };
    })(JSON.parse, JSON.stringify);

    (() => {
        history.push_state = history.pushState;
        history.pushState = (...args) => {
            try {
                if (localStorage.getItem("nst-dev-mode")) console.log(`[NST] History Pushed`, location, args);
                let url = new URL(location.origin + args[2]);
                if (url.pathname.split("/").length >= 3 && url.pathname.split("/")[2]) NST_STG = NST_MTX[Number(url.pathname.split("/")[2])];
                else if (Object.keys(NST_MTX).length == 1) NST_STG = Object.values(NST_MTX)[0];

                if (
                    url.pathname.includes("/watch") &&
                    !location.pathname.includes("/watch") &&
                    !location.pathname.includes("/title") &&
                    !location.search.includes("jbv")
                )
                    location = url;
                else return history.push_state(...args);
            } catch (err) {
                console.error(`[NST] History Push Error`, err);
            }
        };
        history.replace_state = history.replaceState;
        history.replaceState = (...args) => {
            try {
                if (localStorage.getItem("nst-dev-mode")) console.log(`[NST] History Replaced`, location, args);
                let url = new URL(location.origin + args[2]);
                if (url.pathname.split("/").length >= 3 && url.pathname.split("/")[2]) NST_STG = NST_MTX[Number(url.pathname.split("/")[2])];
                else if (Object.keys(NST_MTX).length == 1) NST_STG = Object.values(NST_MTX)[0];

                if (
                    url.pathname.includes("/watch") &&
                    !location.pathname.includes("/watch") &&
                    !location.pathname.includes("/title") &&
                    !location.search.includes("jbv")
                )
                    location = url;
                else return history.replace_state(...args);
            } catch (err) {
                console.error(`[NST] History Replace Error`, err);
            }
        };
    })();
}

function process_data(data) {
    let processed = {
        ip: data.clientIpAddress,
        expiration: data.expiration,
        video_id: data.movieId,
        tracks: {
            video: process_video_data(data.video_tracks),
            audio: process_audio_data(data.audio_tracks),
            text: process_text_data(data.timedtexttracks),
        },
    };
    return processed;
}

function process_text_data(text_data) {
    text_data = text_data.filter((x) => !x.isNoneTrack);

    let tracks = [];
    for (let track of text_data) {
        let rebuild = {
            type: track.rawTrackType,
            lang_code: track.language,
            lang: track.languageDescription,
            forced: track.isForcedNarrative,
        };

        let downloadables = track.ttDownloadables;
        if (downloadables["webvtt-lssdh-ios8"]) {
            rebuild.format = "webvtt";
            rebuild.url = Object.values(downloadables["webvtt-lssdh-ios8"].downloadUrls)[0];
        } else if (downloadables["dfxp-ls-sdh"]) {
            rebuild.format = "dfxp-ls-sdh";
            rebuild.url = Object.values(downloadables["dfxp-ls-sdh"].downloadUrls)[0];
        } else if (downloadables["nflx-cmisc"]) {
            rebuild.format = "nflx-cmisc";
            rebuild.url = Object.values(downloadables["nflx-cmisc"].downloadUrls)[0];
        }

        tracks.push(rebuild);
    }

    return tracks;
}

function process_video_data(video_data) {
    video_data = video_data.filter((x) => !x.isNoneTrack);

    return video_data;
}

function process_audio_data(audio_data) {
    audio_data = audio_data.filter((x) => !x.isNoneTrack);

    return audio_data;
}
//// Date Processing Functions ////

//// DOM Handling Functions ////
function nst_dom_handler() {
    setup_dom_observer();
    if (localStorage.getItem("nst-custom-css")) apply_custom_css(localStorage.getItem("nst-custom-css"));
}

function setup_dom_observer() {
    let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (!location.pathname.includes("/watch")) return;
            if (!window.NST_DOM) window.NST_DOM = {};
            if (!window.NST_MTX) window.NST_MTX = {};
            if (!window.NST_STG) window.NST_STG = {};

            mutation.addedNodes.forEach((node) => {
                // Menu
                if (node.nodeName.toUpperCase() == "DIV") {
                    let menu = (node.parentNode || node).querySelector(".audio-subtitle-controller");
                    if (menu && menu.querySelector(".nst-menu") === null) {
                        setup_menu(menu);
                    }
                }

                // Subtitles
                [...document.querySelectorAll("video")].forEach((x) => {
                    if (!x.parentNode.classList.contains("nst-sub-inserted")) {
                        setup_subtitles(x);
                    }
                });
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function setup_menu(menu) {
    // Append First Subtitle Menu
    menu.appendChild(first_sub_menu());

    // Append Second Subtitle Menu
    menu.appendChild(second_sub_menu());

    // Append Custom Style Menu
    menu.appendChild(panel_menu());

    // Remove .track-list-subtitles & Click 關閉
    let nf_list = menu.querySelector(".track-list-subtitles");
    if (nf_list) {
        [...nf_list.querySelectorAll("li")].forEach((x) => {
            if (x.innerText == "關閉") {
                x.click();
            }
        });
        nf_list.remove();
    }
}

function first_sub_menu() {
    let wrapper = document.createElement("div");
    wrapper.classList.add("nst-menu", "nst-menu-first-sub", "track-list", "structural");
    wrapper.innerHTML = `<h3 class="list-header">第一字幕</h3>`;
    let list = document.createElement("ul");
    NST_STG.tracks.text
        .filter((x) => !x.forced)
        .forEach((x) => {
            let item = document.createElement("li");
            item.classList.add("track", "nst-first-sub-selector", x.lang, x.lang_code);
            if (x.lang_code === NST_STG.sub1) item.classList.add("selected");
            item.innerHTML = x.lang;
            item.addEventListener("click", () => {
                load_sub1(x.lang_code);
                [...list.querySelectorAll("li")].forEach((x) => x.classList.remove("selected"));
                item.classList.add("selected");
            });
            list.appendChild(item);
        });
    let close = document.createElement("li");
    close.classList.add("track", "nst-first-sub-selector", "close");
    if (!NST_STG.sub1) close.classList.add("selected");
    close.innerHTML = "關閉";
    close.addEventListener("click", () => {
        NST_STG.sub1 = null;
        localStorage.removeItem("nst-first-sub");
        [...list.querySelectorAll("li")].forEach((x) => x.classList.remove("selected"));
        close.classList.add("selected");
        console.log(`[NST] First Subtitle: null`);
    });
    list.appendChild(close);

    let first_sub = list.querySelector(`.${localStorage.getItem("nst-first-sub") || "no-item-found"}`);
    if (first_sub) first_sub.click();

    wrapper.appendChild(list);
    return wrapper;
}

function second_sub_menu() {
    let wrapper = document.createElement("div");
    wrapper.classList.add("nst-menu", "nst-menu-second-sub", "track-list", "structural");
    wrapper.innerHTML = `<h3 class="list-header">第二字幕</h3>`;
    let list = document.createElement("ul");
    NST_STG.tracks.text
        .filter((x) => !x.forced)
        .forEach((x) => {
            let item = document.createElement("li");
            item.classList.add("track", "nst-second-sub-selector", x.lang, x.lang_code);
            if (x.lang_code === NST_STG.sub2) item.classList.add("selected");
            item.innerHTML = x.lang;
            item.addEventListener("click", () => {
                load_sub2(x.lang_code);
                [...list.querySelectorAll("li")].forEach((x) => x.classList.remove("selected"));
                item.classList.add("selected");
            });
            list.appendChild(item);
        });
    let close = document.createElement("li");
    close.classList.add("track", "nst-second-sub-selector", "close");
    if (!NST_STG.sub2) close.classList.add("selected");
    close.innerHTML = "關閉";
    close.addEventListener("click", () => {
        NST_STG.sub2 = null;
        localStorage.removeItem("nst-second-sub");
        [...list.querySelectorAll("li")].forEach((x) => x.classList.remove("selected"));
        close.classList.add("selected");
        console.log(`[NST] Second Subtitle: null`);
    });
    list.appendChild(close);

    let second_sub = list.querySelector(`.${localStorage.getItem("nst-second-sub") || "no-item-found"}`);
    if (second_sub) second_sub.click();

    wrapper.appendChild(list);
    return wrapper;
}

function panel_menu() {
    let wrapper = document.createElement("div");
    wrapper.classList.add("nst-menu", "nst-menu-custom-style", "track-list", "structural");
    wrapper.innerHTML = `<h3 class="list-header">控制面板</h3>`;
    let list = document.createElement("ul");

    // 樣式面板
    (() => {
        let item = document.createElement("li");
        item.classList.add("track", "nst-open-custom-style");
        item.innerHTML = `字幕樣式面板`;
        item.addEventListener("click", () => {
            let video = document.querySelector("video");
            if (document.querySelector(".button-nfplayerPause")) document.querySelector(".button-nfplayerPause").click();
            if (!video.paused) document.querySelector("video").pause();

            let panel = document.createElement("div"),
                panel_wrap = document.createElement("div"),
                code_zone = document.createElement("textarea"),
                apply_btn = document.createElement("button");
            panel.classList.add("nst-custom-style-panel");
            panel_wrap.classList.add("nst-custom-style-panel-wrap");
            code_zone.classList.add("nst-custom-style-panel-code");
            apply_btn.classList.add("nst-custom-style-panel-btn");

            code_zone.value = localStorage.getItem("nst-custom-css") || ".nst-sub1 {\n\n}\n.nst-sub2 {\n\n}\n";
            apply_btn.innerHTML = "套用格式";

            panel_wrap.addEventListener("click", function (e) {
                if (this == e.target) this.remove();
            });
            apply_btn.addEventListener("click", function (e) {
                apply_custom_css(code_zone.value);
                panel_wrap.remove();
            });

            panel.appendChild(code_zone);
            panel.appendChild(apply_btn);
            panel_wrap.appendChild(panel);
            document.body.appendChild(panel_wrap);
        });
        list.appendChild(item);
    })();

    // 下載面板
    (() => {
        let item = document.createElement("li");
        item.classList.add("track", "nst-open-download-panel");
        item.innerHTML = `字幕下載面板`;
        item.addEventListener("click", () => {
            let video = document.querySelector("video");
            if (document.querySelector(".button-nfplayerPause")) document.querySelector(".button-nfplayerPause").click();
            if (!video.paused) document.querySelector("video").pause();

            let panel = document.createElement("div"),
                panel_wrap = document.createElement("div"),
                lang_selector_wrap = document.createElement("div"),
                format_selector_wrap = document.createElement("div"),
                lang_selector_label = document.createElement("label"),
                format_selector_label = document.createElement("label"),
                lang_selector = document.createElement("select"),
                format_selector = document.createElement("select"),
                dl_btn = document.createElement("button");
            panel.classList.add("nst-download-panel");
            panel_wrap.classList.add("nst-download-panel-wrap");
            lang_selector_wrap.classList.add("nst-download-panel-lang-select-wrap");
            format_selector_wrap.classList.add("nst-download-panel-format-select-wrap");
            lang_selector_label.classList.add("nst-download-panel-lang-select-label");
            format_selector_label.classList.add("nst-download-panel-format-select-label");
            lang_selector.classList.add("nst-download-panel-lang-select");
            format_selector.classList.add("nst-download-panel-format-select");
            dl_btn.classList.add("nst-download-panel-btn");

            lang_selector_label.innerHTML = "字幕語言";
            format_selector_label.innerHTML = "字幕格式";

            NST_STG.tracks.text
                .filter((x) => !x.forced)
                .forEach((track) => {
                    let option = document.createElement("option");
                    option.value = track.lang_code;
                    option.innerHTML = track.lang;
                    lang_selector.appendChild(option);
                });

            let formats = ["Simple Text", "Netflix WebVTT", "Simplified WebVTT", "SubRip Text", "NST JSON"];
            formats.forEach((type) => {
                let option = document.createElement("option");
                option.value = type;
                option.innerHTML = type;
                format_selector.appendChild(option);
            });

            dl_btn.innerHTML = "下載字幕";

            panel_wrap.addEventListener("click", function (e) {
                if (this == e.target) this.remove();
            });
            dl_btn.addEventListener("click", async function (e) {
                this.disabled = true;

                let { data, ext, mime } = await download_subtitle(lang_selector.value, format_selector.value);
                let blob = new Blob([data], { type: mime });

                let a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${dom_series_data()}-${lang_selector.value}.${ext}`;
                a.click();

                this.disabled = false;
                panel_wrap.remove();
            });

            lang_selector_wrap.appendChild(lang_selector_label);
            lang_selector_wrap.appendChild(lang_selector);
            format_selector_wrap.appendChild(format_selector_label);
            format_selector_wrap.appendChild(format_selector);
            panel.appendChild(lang_selector_wrap);
            panel.appendChild(format_selector_wrap);
            panel.appendChild(dl_btn);
            panel_wrap.appendChild(panel);
            document.body.appendChild(panel_wrap);
        });
        list.appendChild(item);
    })();

    // 測試功能面板
    (() => {
        let item = document.createElement("li");
        item.classList.add("track", "nst-open-testing-panel");
        item.innerHTML = `測試功能面板`;
        item.addEventListener("click", () => {
            let video = document.querySelector("video");
            if (document.querySelector(".button-nfplayerPause")) document.querySelector(".button-nfplayerPause").click();
            if (!video.paused) document.querySelector("video").pause();

            let panel = document.createElement("div"),
                panel_wrap = document.createElement("div"),
                dev_selector_wrap = document.createElement("div"),
                dev_selector_label = document.createElement("label"),
                dev_selector = document.createElement("select"),
                apply_btn = document.createElement("button");
            panel.classList.add("nst-testing-panel");
            panel_wrap.classList.add("nst-testing-panel-wrap");
            dev_selector_wrap.classList.add("nst-testing-panel-dev-select-wrap");
            dev_selector_label.classList.add("nst-testing-panel-dev-select-label");
            dev_selector.classList.add("nst-testing-panel-dev-select");
            apply_btn.classList.add("nst-testing-panel-btn");

            dev_selector_label.innerHTML = "開發者模式";

            ["開啟", "關閉"].forEach((type) => {
                let option = document.createElement("option");
                option.value = type;
                option.innerHTML = type;
                dev_selector.appendChild(option);
            });
            if (localStorage.getItem("nst-dev-mode")) dev_selector.value = "開啟";
            else dev_selector.value = "關閉";

            apply_btn.innerHTML = "套用設定";

            panel_wrap.addEventListener("click", function (e) {
                if (this == e.target) this.remove();
            });
            apply_btn.addEventListener("click", async function (e) {
                if (dev_selector.value == "開啟") localStorage.setItem("nst-dev-mode", dev_selector.value);
                else localStorage.removeItem("nst-dev-mode");
                panel_wrap.remove();
            });

            dev_selector_wrap.appendChild(dev_selector_label);
            dev_selector_wrap.appendChild(dev_selector);
            panel.appendChild(dev_selector_wrap);
            panel.appendChild(apply_btn);
            panel_wrap.appendChild(panel);
            document.body.appendChild(panel_wrap);
        });
        list.appendChild(item);
    })();

    wrapper.appendChild(list);
    return wrapper;
}

function setup_subtitles(video_node) {
    let subtitle_wrap = document.createElement("div");
    let sub1 = document.createElement("span"),
        sub2 = document.createElement("span");
    subtitle_wrap.classList.add("nst-sub-wrap");
    sub1.classList.add("nst-sub1");
    sub2.classList.add("nst-sub2");
    subtitle_wrap.appendChild(sub1);
    subtitle_wrap.appendChild(sub2);
    video_node.parentNode.appendChild(subtitle_wrap);
    NST_DOM.sub1 = sub1;
    NST_DOM.sub2 = sub2;

    if (localStorage.getItem("nst-first-sub")) {
        NST_STG.sub1 = localStorage.getItem("nst-first-sub");
        load_sub1(NST_STG.sub1);
    }
    if (localStorage.getItem("nst-second-sub")) {
        NST_STG.sub2 = localStorage.getItem("nst-second-sub");
        load_sub2(NST_STG.sub2);
    }
    video_node.parentNode.classList.add("nst-sub-inserted");
    console.log(`[NST] Subtitle Elements Ready`);

    video_node.addEventListener("timeupdate", () => {
        try {
            sub_update(video_node.currentTime);
        } catch (e) {}
    });
}

function sub_update(time) {
    if (!document.querySelector(".nst-sub-wrap")) setup_subtitles();

    if (NST_STG.sub1_data || NST_STG.sub2_data) {
        let sub1 = NST_STG.sub1_data ? NST_STG.sub1_data.filter((x) => (x ? x.start <= time && x.end >= time : false)) : [];
        if (NST_STG.sub1 && sub1.length) NST_DOM.sub1.innerHTML = sub1[0].text;
        else NST_DOM.sub1.innerHTML = "";
        let sub2 = NST_STG.sub2_data ? NST_STG.sub2_data.filter((x) => (x ? x.start <= time && x.end >= time : false)) : [];
        if (NST_STG.sub2 && sub2.length) NST_DOM.sub2.innerHTML = sub2[0].text;
        else NST_DOM.sub2.innerHTML = "";
    }
}

function apply_custom_css(css) {
    let style;
    if (!document.querySelector(".nst-custom-style-loader")) {
        style = document.createElement("style");
        style.classList.add("nst-custom-style-loader");
    } else style = document.querySelector(".nst-custom-style-loader");

    style.innerHTML = css;

    if (!document.querySelector(".nst-custom-style-loader")) document.body.appendChild(style);
    localStorage.setItem("nst-custom-css", css);
    console.log(`[NST] Custom CSS Applied`);
}

function dom_series_data(type = "all") {
    switch (type) {
        case "all":
            return dom_series_data("series") + " " + dom_series_data("episode") + " " + dom_series_data("name");
        case "series":
            return document.querySelector(".ellipsize-text").querySelector("h4").innerHTML;
        case "episode":
            return document.querySelector(".ellipsize-text").querySelector("span").innerHTML;
        case "name":
            return document.querySelector(".ellipsize-text").querySelector("span:nth-of-type(2)").innerHTML;
        default:
            return "";
    }
}
//// DOM Handling Functions ////

//// Subtitle Downloading Functions ////
async function load_sub1(lang_code) {
    if (NST_STG.sub1 == lang_code && NST_STG.sub1_data) return;

    NST_STG.sub1 = lang_code;
    localStorage.setItem("nst-first-sub", lang_code);
    console.log(`[NST] First Subtitle: ${lang_code}`);

    try {
        NST_STG.sub1_data = JSON.parse((await download_subtitle(lang_code, "NST JSON", false)).data);
        console.log(`[NST] Subtitle Loaded: ${NST_STG.sub1}`);
    } catch (err) {
        console.warn(`[NST] Sub Loader Error`, err);
    }
}

async function load_sub2(lang_code) {
    if (NST_STG.sub2 == lang_code && NST_STG.sub2_data) return;

    NST_STG.sub2 = lang_code;
    localStorage.setItem("nst-second-sub", lang_code);
    console.log(`[NST] Second Subtitle: ${lang_code}`);

    try {
        NST_STG.sub2_data = JSON.parse((await download_subtitle(lang_code, "NST JSON", false)).data);
        console.log(`[NST] Subtitle Loaded: ${NST_STG.sub2}`);
    } catch (err) {
        console.warn(`[NST] Sub Loader Error`, err);
    }
}

async function download_subtitle(lang_code, format, user = true) {
    let track = NST_STG.tracks.text.filter((x) => x.lang_code == lang_code)[0];
    if (user) console.log(`[NST] Subtitle Download Start. Selected Language: ${track.lang}. Selected Format: ${format}.`);

    let raw = await fetch(track.url).then((r) => r.text());

    if (format == "Netflix WebVTT")
        return {
            ext: "vtt",
            mime: "text/vtt",
            data: raw,
        };

    let subtitle = raw
        .split("\n\n\n")[1]
        .split("\n\n")
        .map((sub) => {
            let splitted = [...sub.matchAll(/(\d{1,4})\n(\d{2}:\d{2}:\d{2}.\d{3}) --> (\d{2}:\d{2}:\d{2}.\d{3})([^]+?)\n([^]+)/g)][0];
            if (!splitted) return null;
            let start_time = splitted[2].split(":").map(parseFloat);
            let end_time = splitted[3].split(":").map(parseFloat);
            return {
                n: parseInt(splitted[1]),
                start: start_time[0] * 3600 + start_time[1] * 60 + start_time[2],
                end: end_time[0] * 3600 + end_time[1] * 60 + end_time[2],
                style: splitted[4].trim(),
                text: splitted[5].replaceAll(/<[^>]*>/g, "").trim(),
            };
        })
        .filter((x) => x)
        .sort((a, b) => {
            if (a && b) return a.n - b.n;
            else return 0;
        });

    if (format == "NST JSON")
        return {
            ext: "json",
            mime: "application/json",
            data: JSON.stringify(subtitle),
        };

    if (format == "Simplified WebVTT") {
        let vtt = `WEBVTT\n\n`;
        subtitle.forEach((line) => {
            vtt += line.n + "\n";
            vtt +=
                [parseInt(line.start / 3600), parseInt((line.start % 3600) / 60), parseInt(line.start % 60)].map((x) => String(x).padStart(2, "0")).join(":") +
                "." +
                (line.start % 1).toFixed(3).substr(2);
            vtt += " --> ";
            vtt +=
                [parseInt(line.end / 3600), parseInt((line.end % 3600) / 60), parseInt(line.end % 60)].map((x) => String(x).padStart(2, "0")).join(":") +
                "." +
                (line.end % 1).toFixed(3).substr(2);
            vtt += "\n";
            vtt += line.text + "\n\n";
        });
        return {
            ext: "vtt",
            mime: "text/vtt",
            data: vtt,
        };
    } else if (format == "SubRip Text") {
        let srt = ``;
        subtitle.forEach((line) => {
            srt += line.n + "\n";
            srt +=
                [parseInt(line.start / 3600), parseInt((line.start % 3600) / 60), parseInt(line.start % 60)].map((x) => String(x).padStart(2, "0")).join(":") +
                "," +
                (line.start % 1).toFixed(3).substr(2);
            srt += " --> ";
            srt +=
                [parseInt(line.end / 3600), parseInt((line.end % 3600) / 60), parseInt(line.end % 60)].map((x) => String(x).padStart(2, "0")).join(":") +
                "," +
                (line.end % 1).toFixed(3).substr(2);
            srt += "\n";
            srt += line.text + "\n\n";
        });
        return {
            ext: "srt",
            mime: "text/plain",
            data: srt,
        };
    } else {
        let text = `\n`;
        subtitle.forEach((line) => {
            text += line.text + "\n\n";
        });
        return {
            ext: "txt",
            mime: "text/plain",
            data: text,
        };
    }
}
//// Subtitle Downloading Functions ////
