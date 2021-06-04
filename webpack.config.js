module.exports = {
    context: __dirname,
    entry: "./script.js",
    mode: "production",
    optimization: {
        minimize: true,
    },
    output: {
        filename: "script.min.js",
        path: __dirname,
    },
};
