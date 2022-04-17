const fs = require("fs");
const path = require("path");
const ResolveTypeScriptPlugin = require("resolve-typescript-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const { version } = require("./package.json");
const manifestV2 = require("./resources/manifest.v2.json");
const manifestV3 = require("./resources/manifest.v3.json");

const { BROWSER } = process.env;
const DIST = path.resolve(__dirname, "dist");
const INDEX_TEMPLATE = path.resolve(__dirname, "./resources/template.pug");

function buildManifest(assetNames, manifest) {
    const newManifest = JSON.parse(JSON.stringify(manifest));
    newManifest.version = version;
    assetNames.forEach((assetFilename) => {
        if (/^[^\/\\]+\.js$/.test(assetFilename)) {
            if (/\bbackground\b/.test(assetFilename) && assetFilename !== "background.js") {
                newManifest.background.scripts.unshift(assetFilename);
            }
            if (/\btab\b/.test(assetFilename) && assetFilename !== "tab.js") {
                newManifest.content_scripts[0].js.unshift(assetFilename);
            }
        }
    });
    fs.writeFileSync(path.join(DIST, "./manifest.json"), JSON.stringify(newManifest, undefined, 2));
}

if (!BROWSER) {
    throw new Error("BROWSER must be specified");
}

module.exports = {
    devtool: false,

    entry: {
        background: path.resolve(__dirname, "./source/background/index.ts"),
        popup: path.resolve(__dirname, "./source/popup/index.tsx")
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: "babel-loader",
                        options: {
                            compact: true,
                            presets: [
                                [
                                    "@babel/preset-env",
                                    {
                                        targets: {
                                            chrome: "90",
                                            firefox: "85",
                                            edge: "90"
                                        },
                                        useBuiltIns: false
                                    }
                                ]
                            ]
                        }
                    },
                    {
                        loader: "ts-loader"
                    }
                ],
                resolve: {
                    fullySpecified: false
                }
            },
            {
                test: /\.pug$/,
                loader: "pug-loader"
            },
            {
                test: /\.(jpg|png|svg|eot|svg|ttf|woff|woff2)$/,
                loader: "file-loader",
                options: {
                    name: "[name].[hash].[ext]"
                }
            }
        ]
    },

    optimization: {
        splitChunks: {
            automaticNameDelimiter: "-",
            chunks: "all",
            // chunks: chunk => {
            //     return chunk.name !== "background";
            // },
            maxSize: Infinity,
            minSize: 30000
        }
    },

    output: {
        filename: "[name].js",
        chunkFilename: "[name].chunk.js",
        path: DIST,
        chunkLoadingGlobal: "__bcupjsonp"
    },

    performance: {
        hints: false,
        maxEntrypointSize: 768000,
        maxAssetSize: 768000
    },

    plugins: [
        {
            apply: (compiler) => {
                compiler.hooks.afterEmit.tap("AfterEmitPlugin", (compilation) => {
                    buildManifest(
                        Object.keys(compilation.getStats().compilation.assets),
                        BROWSER === "chrome" ? manifestV3 : manifestV2
                    );
                });
            }
        },
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(__dirname, "./resources", "buttercup-*.png"),
                    to: DIST,
                    context: path.join(__dirname, "./resources")
                }
            ]
        }),
        new HtmlWebpackPlugin({
            title: "Buttercup",
            template: INDEX_TEMPLATE,
            filename: "popup.html",
            inject: "body"
            // chunks: ["popup"]
        })
    ],

    resolve: {
        // No .ts/.tsx included due to the typescript resolver plugin
        extensions: [".js", ".jsx"],
        fallback: {
            buffer: false,
            fs: false,
            path: false
        },
        plugins: [
            // Handle .ts => .js resolution
            new ResolveTypeScriptPlugin()
        ]
    }
};
