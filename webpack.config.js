module.exports = {
    context: __dirname,
    entry: "./script.js",
    mode: "production",
    optimization: {
        minimize: false,
    },
    output: {
        filename: "script.min.js",
        path: __dirname,
    },
};
