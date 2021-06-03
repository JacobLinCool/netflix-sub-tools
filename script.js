let NFLX_TOOL_STG = {
    video_id: null,
    sub1: null,
    sub1_data: null,
    sub2: null,
    sub2_data: null,
};
let NFLX_TOOL_DOM = {};

overwrite_global_functions();
window.addEventListener("load", add_menu);

function overwrite_global_functions() {
    ((parse, stringify) => {
        JSON.parse = (text) => {
            let data = parse(text);
            if (data && data.result && data.result.movieId && NFLX_TOOL_STG.video_id !== data.result.movieId) process_data(data.result);
            return data;
        };

        JSON.stringify = (data) => {
            if (data && typeof data.url === "string" && data.url.search(new RegExp("manifest|licensedManifest")) > -1) {
                for (let v of Object.values(data)) {
                    try {
                        v.profiles.unshift("webvtt-lssdh-ios8");
                        v.showAllSubDubTracks = true;
                    } catch (err) {
                        if (!(err instanceof TypeError)) console.error(`[Netflix Subtitle Tools] Error: `, err);
                    }
                }
            }

            return stringify(data);
        };
    })(JSON.parse, JSON.stringify);
}

async function process_data(data) {
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
    console.log(processed);
    NFLX_TOOL_STG = processed;
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

function add_menu() {
    let found_video = false;
    let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName.toUpperCase() == "DIV") {
                    let menu = (node.parentNode || node).querySelector(".audio-subtitle-controller");
                    if (menu && menu.querySelector(".nst-menu") === null) {
                        // First Subtitle
                        (() => {
                            let wrapper = document.createElement("div");
                            wrapper.classList.add("nst-menu", "track-list", "structural");
                            wrapper.innerHTML = `<h3 class="list-header">第一字幕</h3>`;
                            let list = document.createElement("ul");
                            NFLX_TOOL_STG.tracks.text
                                .filter((x) => !x.forced)
                                .forEach((x) => {
                                    let item = document.createElement("li");
                                    item.classList.add("track", "nst-first-sub-selector");
                                    if (x.lang_code === NFLX_TOOL_STG.sub1) item.classList.add("selected");
                                    item.innerHTML = x.lang;
                                    item.addEventListener("click", () => {
                                        NFLX_TOOL_STG.sub1 = x.lang_code;
                                        item.classList.add("selected");
                                        load_sub1();
                                        console.log(`[Netflix Subtitle Tools] First Subtitle: ${x.lang_code}`);
                                    });
                                    list.appendChild(item);
                                });
                            wrapper.appendChild(list);
                            menu.appendChild(wrapper);
                        })();

                        // Second Subtitle
                        (() => {
                            let wrapper = document.createElement("div");
                            wrapper.classList.add("nst-menu", "track-list", "structural");
                            wrapper.innerHTML = `<h3 class="list-header">第二字幕</h3>`;
                            let list = document.createElement("ul");
                            NFLX_TOOL_STG.tracks.text
                                .filter((x) => !x.forced)
                                .forEach((x) => {
                                    let item = document.createElement("li");
                                    item.classList.add("track", "nst-second-sub-selector");
                                    if (x.lang_code === NFLX_TOOL_STG.sub2) item.classList.add("selected");
                                    item.innerHTML = x.lang;
                                    item.addEventListener("click", () => {
                                        NFLX_TOOL_STG.sub2 = x.lang_code;
                                        item.classList.add("selected");
                                        load_sub2();
                                        console.log(`[Netflix Subtitle Tools] Second Subtitle: ${x.lang_code}`);
                                    });
                                    list.appendChild(item);
                                });
                            wrapper.appendChild(list);
                            menu.appendChild(wrapper);
                        })();
                    }
                }
                if (!found_video && document.querySelector("video")) {
                    found_video = true;
                    document.querySelector("video").addEventListener("timeupdate", () => {
                        sub_update(document.querySelector("video").currentTime);
                    });

                    let subtitle_wrap = document.createElement("div");
                    let sub1 = document.createElement("span"),
                        sub2 = document.createElement("span");
                    subtitle_wrap.classList.add("nst-sub-wrap");
                    sub1.classList.add("nst-sub1");
                    sub2.classList.add("nst-sub2");
                    subtitle_wrap.appendChild(sub1);
                    subtitle_wrap.appendChild(sub2);
                    document.querySelector("video").parentElement.appendChild(subtitle_wrap);
                    NFLX_TOOL_DOM.sub1 = sub1;
                    NFLX_TOOL_DOM.sub2 = sub2;
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function sub_update(time) {
    if (NFLX_TOOL_STG.sub1_data || NFLX_TOOL_STG.sub2_data) {
        let sub1 = NFLX_TOOL_STG.sub1_data ? NFLX_TOOL_STG.sub1_data.filter((x) => (x ? x.start <= time && x.end >= time : false)) : [];
        if (sub1.length) NFLX_TOOL_DOM.sub1.innerHTML = sub1[0].text;
        else NFLX_TOOL_DOM.sub1.innerHTML = "";
        let sub2 = NFLX_TOOL_STG.sub2_data ? NFLX_TOOL_STG.sub2_data.filter((x) => (x ? x.start <= time && x.end >= time : false)) : [];
        if (sub2.length) NFLX_TOOL_DOM.sub2.innerHTML = sub2[0].text;
        else NFLX_TOOL_DOM.sub2.innerHTML = "";
    }
}

async function load_sub1() {
    if (!NFLX_TOOL_STG.sub1) return;
    let url = NFLX_TOOL_STG.tracks.text.filter((x) => x.lang_code == NFLX_TOOL_STG.sub1)[0].url;
    vtt = (await fetch(url).then((r) => r.text()))
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
        .sort((a, b) => {
            if (a && b) return a.n - b.n;
            else return 0;
        });

    NFLX_TOOL_STG.sub1_data = vtt;
    console.log(vtt);
}

async function load_sub2() {
    if (!NFLX_TOOL_STG.sub2) return;
    let url = NFLX_TOOL_STG.tracks.text.filter((x) => x.lang_code == NFLX_TOOL_STG.sub2)[0].url;
    vtt = (await fetch(url).then((r) => r.text()))
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
        .sort((a, b) => {
            if (a && b) return a.n - b.n;
            else return 0;
        });

    NFLX_TOOL_STG.sub2_data = vtt;
    console.log(vtt);
}
