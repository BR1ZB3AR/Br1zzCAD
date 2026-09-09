import { resolve } from "node:path";
import { defineConfig } from "@rspack/cli";
import rspack from "@rspack/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";
import packages from "./package.json" with { type: "json" };

const isProduction = process.env.NODE_ENV === "production";
const configDir = import.meta.dirname;

export default defineConfig({
    devtool: isProduction ? false : "source-map",
    entry: {
        main: "./packages/web/src/index.ts",
    },
    experiments: {
        css: true,
    },
    module: {
        parser: {
            "css/auto": {
                namedExports: false,
            },
        },
        rules: [
            {
                test: /\.css$/,
                type: "css/auto",
            },
            {
                test: /\.wasm$/,
                type: "asset",
            },
            {
                test: /\.cur$/,
                type: "asset",
            },
            {
                test: /\.jpg$/,
                type: "asset",
            },
            {
                test: /\.(j|t)s$/,
                loader: "builtin:swc-loader",
                options: {
                    jsc: {
                        parser: {
                            syntax: "typescript",
                            decorators: true,
                        },
                        target: "esnext",
                    },
                    collectTypeScriptInfo: {
                        exportedEnum: isProduction,
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js", ".json", ".wasm"],
    },
    plugins: [
        new TsCheckerRspackPlugin(),
        new rspack.CircularDependencyRspackPlugin({
            failOnError: true,
            exclude: /node_modules/,
        }),
        new rspack.CopyRspackPlugin({
            patterns: [
                {
                    from: resolve(configDir, "public"),
                    globOptions: {
                        ignore: ["**/**/index.html"],
                    },
                },
            ],
        }),
        new rspack.DefinePlugin({
            __APP_VERSION__: JSON.stringify(packages.version),
            __DOCUMENT_VERSION__: JSON.stringify(packages.documentVersion),
            __IS_PRODUCTION__: JSON.stringify(process.env.NODE_ENV === "production"),
        }),
        new rspack.HtmlRspackPlugin({
            template: resolve(configDir, "public/index.html"),
            inject: "body",
        }),
    ],
    optimization: {
        minimizer: [
            new rspack.SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                    mangle: {
                        keep_classnames: true,
                        keep_fnames: true,
                    },
                },
            }),
            new rspack.LightningCssMinimizerRspackPlugin(),
        ],
    },
    output: {
        clean: true,
        // Content-hashed filenames (production only) so every deploy gets a
        // distinct URL for its JS/CSS - GitHub Pages doesn't support custom
        // cache-control headers, so a fixed "main.js" means browsers/CDNs can
        // keep serving a stale bundle indefinitely after a new deploy even
        // though index.html itself (short max-age) picks up the new build
        // right away. Dev mode keeps stable names: rspack-dev-server's HMR
        // (live CSS/module reload) tracks updates against a fixed bundle
        // filename, and a hash that changes on every rebuild breaks it.
        filename: isProduction ? "[name].[contenthash].js" : "[name].js",
        chunkFilename: isProduction ? "[name].[contenthash].js" : "[name].js",
        cssFilename: isProduction ? "[name].[contenthash].css" : "[name].css",
        cssChunkFilename: isProduction ? "[name].[contenthash].css" : "[name].css",
    },
});
